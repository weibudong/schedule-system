import dotenv from 'dotenv';
dotenv.config();

import cron from 'node-cron';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
// 存储路径统一由 db/index 解析：CloudBase 生产环境落储存桶 /mnt/data，本地开发落项目目录
import { dbPath, backupDataDir, dbBackupDir, storageLocation } from '../db/index.js';

const isCloudBase = process.env.CLOUDBASE_ENV === 'true';
const isEmas = process.env.EMAS_ENV === 'true';
const isProduction = process.env.NODE_ENV === 'production';

console.log('[Backup] 存储位置:', storageLocation);
console.log('[Backup] 数据库路径:', dbPath);
console.log('[Backup] DB备份目录:', dbBackupDir);

const BACKUP_CONFIG = {
  cron: '0 2 * * *'
};

let lastBackupTime: Date | null = null;

// 手动复制 .db 备份文件到备份目录（生产环境为储存桶 /mnt/data/backup）
function copyBackupToProject(timeStr: string): string | null {
  try {
    if (!fs.existsSync(dbPath)) return null;

    const copyDir = dbBackupDir;
    if (!fs.existsSync(copyDir)) {
      fs.mkdirSync(copyDir, { recursive: true });
    }

    const copyPath = path.join(copyDir, `dev-backup-${timeStr}.db`);
    fs.copyFileSync(dbPath, copyPath);
    console.log(`[Backup] 数据库备份已复制到: ${copyPath}`);
    return copyPath;
  } catch (error) {
    console.warn('[Backup] 复制备份失败:', error);
    return null;
  }
}

async function sendBackup(): Promise<{
  success: boolean;
  emailSent: boolean;
  jsonExported: boolean;
  dbCopied: boolean;
  errors: string[];
  backupTime: string;
}> {
  const errors: string[] = [];
  const emailSent = false;
  const jsonExported = false;
  let dbCopied = false;

  const now = new Date();
  const timeStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  console.log(`\n[Backup] ========== 开始备份 ${timeStr} ==========`);

  // 复制 .db 文件到 backup 目录（生产环境为储存桶 /mnt/data/backup）
  const copyPath = copyBackupToProject(timeStr);
  if (copyPath) {
    dbCopied = true;
  } else {
    errors.push('数据库复制失败');
  }

  lastBackupTime = now;
  const success = dbCopied;

  const result = {
    success,
    emailSent,
    jsonExported,
    dbCopied,
    errors,
    backupTime: now.toLocaleString('zh-CN')
  };

  console.log(`[Backup] ========== 备份完成 ==========`);
  console.log(`[Backup] DB复制: ${dbCopied ? '✓' : '✗'}`);
  if (errors.length > 0) {
    console.log(`[Backup] 错误: ${errors.join(', ')}`);
  }
  console.log('');

  return result;
}

// 从备份恢复数据
async function restoreFromBackup(dateStr: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 支持从 JSON 文件恢复
    const jsonFile = path.join(backupDataDir, `data-${dateStr}.json`);

    if (fs.existsSync(jsonFile)) {
      const backupData = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
      const db = new Database(dbPath);

      db.exec('DELETE FROM users; DELETE FROM appointments; DELETE FROM overdue_items; DELETE FROM overdue_periods; DELETE FROM performance;');

      const insertUsers = db.prepare('INSERT INTO users (id, name, phone, password, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)');
      const insertAppointments = db.prepare('INSERT INTO appointments (id, customerName, phone, company, province, city, content, amount, type, courseType, status, invoicedAt, paidAt, teacherId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const insertOverdueItems = db.prepare('INSERT INTO overdue_items (id, item, createdAt) VALUES (?, ?, ?)');
      const insertOverduePeriods = db.prepare('INSERT INTO overdue_periods (id, period, amount, createdAt) VALUES (?, ?, ?, ?)');
      const insertPerformance = db.prepare('INSERT INTO performance (id, userId, amount, orderDate, invoiceDate, paymentDate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)');

      const insertAll = db.transaction(() => {
        backupData.tables.users.forEach((user: any) => insertUsers.run(user.id, user.name, user.phone, user.password, user.role, user.createdAt));
        backupData.tables.appointments.forEach((appt: any) => insertAppointments.run(appt.id, appt.customerName, appt.phone, appt.company, appt.province, appt.city, appt.content, appt.amount, appt.type, appt.courseType, appt.status, appt.invoicedAt, appt.paidAt, appt.teacherId, appt.createdAt));
        backupData.tables.overdue_items.forEach((item: any) => insertOverdueItems.run(item.id, item.item, item.createdAt));
        backupData.tables.overdue_periods.forEach((period: any) => insertOverduePeriods.run(period.id, period.period, period.amount, period.createdAt));
        backupData.tables.performance.forEach((perf: any) => insertPerformance.run(perf.id, perf.userId, perf.amount, perf.orderDate, perf.invoiceDate, perf.paymentDate, perf.createdAt));
      });

      insertAll();
      db.close();
      console.log(`[Backup] 数据从JSON恢复成功: ${dateStr}`);
      return { success: true };
    }

    // 支持从 .db 文件恢复
    const dbFile = path.join(dbBackupDir, `dev-backup-${dateStr}.db`);
    if (fs.existsSync(dbFile)) {
      fs.copyFileSync(dbFile, dbPath);
      console.log(`[Backup] 数据库文件恢复成功: ${dateStr}`);
      return { success: true };
    }

    return { success: false, error: `备份文件不存在: ${jsonFile} 或 ${dbFile}` };
  } catch (error) {
    console.error('[Backup] 数据恢复失败:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function startBackupCron() {
  if (!fs.existsSync(dbBackupDir)) {
    fs.mkdirSync(dbBackupDir, { recursive: true });
  }

  // 打印配置
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  数据备份服务启动                                            ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  运行环境: ${isProduction ? '生产环境' : '开发环境'}`);
  console.log(`║  云平台: ${isCloudBase ? 'CloudBase' : isEmas ? 'EMAS' : '本地'}`);
  console.log(`║  数据库: ${dbPath}`);
  console.log(`║  DB备份目录: ${dbBackupDir}`);
  console.log(`║  定时任务: ${BACKUP_CONFIG.cron} (每日凌晨2点，仅复制 .db)`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // 定时备份（仅生产环境）
  if (isProduction) {
    cron.schedule(BACKUP_CONFIG.cron, async () => {
      await sendBackup();
    }, {
      timezone: 'Asia/Shanghai'
    });
    console.log(`[Backup] 定时任务已启动: ${BACKUP_CONFIG.cron}`);
  } else {
    console.log('[Backup] 开发环境，跳过定时备份');
  }

  console.log('[Backup] 手动备份接口仍可使用: POST /api/backup');
}

export { sendBackup, restoreFromBackup, lastBackupTime, backupDataDir };
