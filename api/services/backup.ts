import dotenv from 'dotenv';
dotenv.config();

import cron from 'node-cron';
import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isCloudBase = process.env.CLOUDBASE_ENV === 'true';
const isEmas = process.env.EMAS_ENV === 'true';
const isServerless = isCloudBase || isEmas;
const isProduction = process.env.NODE_ENV === 'production';

// 数据库路径
let dbPath: string;
let projectRoot: string;
let hasPersistence: boolean;

if (isServerless) {
  try {
    fs.mkdirSync('/mnt/data', { recursive: true });
    dbPath = '/mnt/data/dev.db';
    projectRoot = '/mnt';
    hasPersistence = true;
    console.log('[Backup] 使用持久化存储: /mnt/data');
  } catch (err) {
    console.warn('[Backup] 无持久化存储，使用容器文件系统（容器重启会丢失数据）');
    dbPath = path.join(__dirname, '..', 'dev.db');
    projectRoot = path.join(__dirname, '..', '..');
    hasPersistence = false;
  }
} else {
  dbPath = path.join(__dirname, '..', 'dev.db');
  projectRoot = path.join(__dirname, '..', '..');
  hasPersistence = true;
}

// 备份数据目录
const backupDataDir = path.join(projectRoot, 'data');

const BACKUP_CONFIG = {
  // 定时备份：凌晨2点（有持久化）或每小时（无持久化）
  cron: hasPersistence ? '0 2 * * *' : '0 * * * *',
  // 自动备份间隔（分钟），无持久化时生效
  autoBackupInterval: hasPersistence ? 0 : 30,
  mail: {
    from: process.env.MAIL_FROM || '307641135@qq.com',
    to: process.env.MAIL_TO || '307641135@qq.com',
    auth: {
      user: process.env.MAIL_USER || '307641135@qq.com',
      pass: process.env.MAIL_PASS || ''
    },
    host: 'smtp.qq.com',
    port: 465,
    secure: true
  },
  enableGitPush: process.env.ENABLE_GIT_PUSH === 'true' || !isProduction
};

let lastBackupTime: Date | null = null;
let backupInterval: ReturnType<typeof setInterval> | null = null;

function getTransporter() {
  if (!BACKUP_CONFIG.mail.auth.pass) {
    return null;
  }

  return nodemailer.createTransport({
    host: BACKUP_CONFIG.mail.host,
    port: BACKUP_CONFIG.mail.port,
    secure: BACKUP_CONFIG.mail.secure,
    auth: BACKUP_CONFIG.mail.auth,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000
  });
}

// 导出数据库为 JSON 文件
function exportToJson(dateStr: string): { success: boolean; filePath?: string; error?: string } {
  try {
    if (!fs.existsSync(dbPath)) {
      return { success: false, error: '数据库文件不存在' };
    }

    const db = new Database(dbPath, { readonly: true });
    
    const exportData = {
      exportDate: new Date().toISOString(),
      exportTimezone: 'Asia/Shanghai',
      sourcePath: dbPath,
      tables: {} as Record<string, any[]>
    };

    exportData.tables.users = db.prepare('SELECT * FROM users').all();
    exportData.tables.appointments = db.prepare('SELECT * FROM appointments').all();
    exportData.tables.overdue_items = db.prepare('SELECT * FROM overdue_items').all();
    exportData.tables.overdue_periods = db.prepare('SELECT * FROM overdue_periods').all();
    exportData.tables.performance = db.prepare('SELECT * FROM performance').all();

    db.close();

    if (!fs.existsSync(backupDataDir)) {
      fs.mkdirSync(backupDataDir, { recursive: true });
    }

    const jsonFilePath = path.join(backupDataDir, `data-${dateStr}.json`);
    fs.writeFileSync(jsonFilePath, JSON.stringify(exportData, null, 2), 'utf-8');

    console.log(`[Backup] 数据导出成功: ${jsonFilePath}`);
    return { success: true, filePath: jsonFilePath };
  } catch (error) {
    console.error('[Backup] 导出失败:', error instanceof Error ? error.message : error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// 清理旧备份文件（保留最近7天）
function cleanOldBackups() {
  try {
    if (!fs.existsSync(backupDataDir)) return;
    
    const files = fs.readdirSync(backupDataDir).filter(f => f.startsWith('data-') && f.endsWith('.json'));
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    
    let deletedCount = 0;
    files.forEach(file => {
      const filePath = path.join(backupDataDir, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < sevenDaysAgo) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    });
    
    if (deletedCount > 0) {
      console.log(`[Backup] 清理旧备份: 删除 ${deletedCount} 个过期文件`);
    }
  } catch (err) {
    console.warn('[Backup] 清理旧备份失败:', err);
  }
}

// 推送到 Git
function pushToGit(dateStr: string): { success: boolean; error?: string } {
  try {
    if (!BACKUP_CONFIG.enableGitPush) {
      return { success: false, error: 'Git push disabled' };
    }

    try {
      execSync('git rev-parse --is-inside-work-tree', { cwd: projectRoot, stdio: 'pipe' });
    } catch {
      return { success: false, error: 'Not in a Git repository' };
    }

    const dataDirPath = path.join(projectRoot, 'data');
    if (fs.existsSync(dataDirPath)) {
      execSync('git add data/', { cwd: projectRoot, stdio: 'pipe' });
      
      const commitMessage = `[自动备份] 数据备份 ${dateStr}`;
      execSync(`git commit -m "${commitMessage}" --allow-empty`, { cwd: projectRoot, stdio: 'pipe' });
      
      try {
        execSync('git push origin main', { 
          cwd: projectRoot, 
          stdio: 'pipe',
          timeout: 30000 
        });
        console.log('[Backup] Git 推送成功');
        return { success: true };
      } catch (pushError) {
        return { success: false, error: `Git push failed: ${pushError instanceof Error ? pushError.message : String(pushError)}` };
      }
    }
    return { success: false, error: 'No data directory' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function sendBackup(): Promise<{ 
  success: boolean; 
  emailSent: boolean; 
  jsonExported: boolean; 
  gitPushed: boolean; 
  errors: string[];
  backupTime: string;
  persistenceMode: string;
}> {
  const errors: string[] = [];
  let emailSent = false;
  let jsonExported = false;
  let gitPushed = false;

  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = `${dateStr}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  // 步骤1：导出 JSON
  const exportResult = exportToJson(timeStr);
  if (exportResult.success) {
    jsonExported = true;
  } else {
    errors.push(`JSON导出失败: ${exportResult.error}`);
  }

  // 步骤2：发送邮件
  const transporter = getTransporter();
  if (transporter) {
    try {
      if (!fs.existsSync(dbPath)) {
        errors.push('数据库文件不存在');
      } else {
        const attachments: any[] = [
          {
            filename: `dev-backup-${timeStr}.db`,
            path: dbPath,
            contentType: 'application/octet-stream'
          }
        ];

        if (exportResult.success && exportResult.filePath) {
          attachments.push({
            filename: `data-${timeStr}.json`,
            path: exportResult.filePath,
            contentType: 'application/json'
          });
        }

        await transporter.sendMail({
          from: BACKUP_CONFIG.mail.from,
          to: BACKUP_CONFIG.mail.to,
          subject: `[${hasPersistence ? '每日' : '紧急'}备份] 行程系统 ${timeStr}${hasPersistence ? '' : '（无持久化存储）'}`,
          text: `备份时间：${now.toLocaleString('zh-CN')}\n\n存储模式：${hasPersistence ? '持久化存储' : '容器临时存储（容器重启会丢失数据）'}\n数据库路径：${dbPath}\n\n附件：\n1. 数据库备份 (.db)\n2. 数据导出 (.json)`,
          attachments
        });

        emailSent = true;
        console.log(`[Backup] 邮件发送成功: ${timeStr}`);
      }
    } catch (error) {
      errors.push(`邮件发送失败: ${error instanceof Error ? error.message : String(error)}`);
      console.error('[Backup] 邮件发送失败:', error);
    }
  }

  // 步骤3：推送到 Git
  if (jsonExported) {
    const gitResult = pushToGit(timeStr);
    if (gitResult.success) {
      gitPushed = true;
    } else {
      errors.push(`Git推送失败: ${gitResult.error}`);
    }
  }

  // 步骤4：清理旧备份
  if (jsonExported) {
    cleanOldBackups();
  }

  lastBackupTime = now;
  const success = emailSent || jsonExported;
  
  return { 
    success, 
    emailSent, 
    jsonExported, 
    gitPushed,
    errors,
    backupTime: now.toLocaleString('zh-CN'),
    persistenceMode: hasPersistence ? '持久化存储' : '容器临时存储'
  };
}

// 从备份恢复数据
async function restoreFromBackup(dateStr: string): Promise<{ success: boolean; error?: string }> {
  try {
    const jsonFile = path.join(backupDataDir, `data-${dateStr}.json`);
    if (!fs.existsSync(jsonFile)) {
      return { success: false, error: `备份文件不存在: ${jsonFile}` };
    }

    const backupData = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
    const db = new Database(dbPath);

    // 清空现有数据并恢复
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

    console.log(`[Backup] 数据恢复成功: ${dateStr}`);
    return { success: true };
  } catch (error) {
    console.error('[Backup] 数据恢复失败:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function startBackupCron() {
  if (!fs.existsSync(backupDataDir)) {
    fs.mkdirSync(backupDataDir, { recursive: true });
  }

  // 打印存储模式警告
  if (!hasPersistence) {
    console.warn('╔══════════════════════════════════════════════════════════════╗');
    console.warn('║  ⚠️  警告：当前无持久化存储！                                 ║');
    console.warn('║  数据保存在容器临时文件系统中，容器重启会丢失！                ║');
    console.warn('║  建议：                                                       ║');
    console.warn('║  1. 在 CloudBase 控制台配置持久化存储                          ║');
    console.warn('║  2. 定时备份邮件和 Git（已启用）                               ║');
    console.warn('║  3. 每30分钟自动备份一次（已启用）                             ║');
    console.warn('╚══════════════════════════════════════════════════════════════╝');
  }

  // 定时备份
  cron.schedule(BACKUP_CONFIG.cron, async () => {
    console.log(`[Backup] 定时备份开始... (${hasPersistence ? '每日凌晨2点' : '每小时'})`);
    const result = await sendBackup();
    console.log('[Backup] 备份结果:', JSON.stringify({
      success: result.success,
      emailSent: result.emailSent,
      jsonExported: result.jsonExported,
      gitPushed: result.gitPushed,
      errors: result.errors
    }));
  }, {
    timezone: 'Asia/Shanghai'
  });

  // 无持久化时增加30分钟自动备份
  if (!hasPersistence && BACKUP_CONFIG.autoBackupInterval > 0) {
    console.log(`[Backup] 启用每${BACKUP_CONFIG.autoBackupInterval}分钟自动备份`);
    backupInterval = setInterval(async () => {
      console.log('[Backup] 自动备份开始（30分钟间隔）...');
      const result = await sendBackup();
      console.log('[Backup] 自动备份结果:', result.success ? '成功' : '部分失败');
    }, BACKUP_CONFIG.autoBackupInterval * 60 * 1000);
  }

  // 服务启动后立即执行一次备份
  setTimeout(async () => {
    console.log('[Backup] 启动后首次备份...');
    await sendBackup();
  }, 5000);

  console.log(`[Backup] 配置摘要:`);
  console.log(`  存储模式: ${hasPersistence ? '持久化存储' : '容器临时存储'}`);
  console.log(`  定时备份: ${BACKUP_CONFIG.cron}`);
  console.log(`  邮件通知: ${BACKUP_CONFIG.mail.to}`);
  console.log(`  Git推送: ${BACKUP_CONFIG.enableGitPush ? '启用' : '禁用'}`);
  console.log(`  JSON目录: ${backupDataDir}`);
  if (!hasPersistence) {
    console.log(`  自动备份: 每${BACKUP_CONFIG.autoBackupInterval}分钟`);
  }
}

export { sendBackup, restoreFromBackup, lastBackupTime, hasPersistence, backupDataDir };
