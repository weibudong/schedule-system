import dotenv from 'dotenv';
dotenv.config();

import cron from 'node-cron';
import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isCloudBase = process.env.CLOUDBASE_ENV === 'true';
const isEmas = process.env.EMAS_ENV === 'true';
const isProduction = process.env.NODE_ENV === 'production';

// 数据库路径：始终使用 api/dev.db
// 在生产环境中: /app/api/dev.db
// 在本地环境中: api/dev.db
const dbPath = path.join(__dirname, '..', 'dev.db');
const projectRoot = path.join(__dirname, '..', '..');
const backupDataDir = path.join(projectRoot, 'data');

console.log('[Backup] 数据库路径:', dbPath);
console.log('[Backup] 项目根目录:', projectRoot);
console.log('[Backup] 备份目录:', backupDataDir);

const BACKUP_CONFIG = {
  cron: '0 2 * * *',
  mail: {
    from: process.env.MAIL_FROM || '307641135@qq.com',
    to: process.env.MAIL_TO || '307641135@qq.com',
    auth: {
      user: process.env.MAIL_USER || '307641135@qq.com',
      pass: process.env.MAIL_PASS || ''
    },
    // QQ邮箱 SMTP 配置
    host: process.env.SMTP_HOST || 'smtp.qq.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE !== 'false'
  }
};

let lastBackupTime: Date | null = null;

function getTransporter() {
  if (!BACKUP_CONFIG.mail.auth.pass) {
    console.warn('[Backup] MAIL_PASS not configured, email backup disabled');
    return null;
  }

  console.log('[Backup] 创建邮件传输器:', {
    host: BACKUP_CONFIG.mail.host,
    port: BACKUP_CONFIG.mail.port,
    secure: BACKUP_CONFIG.mail.secure,
    user: BACKUP_CONFIG.mail.auth.user
  });

  // QQ邮箱支持两种方式：
  // 1. 465端口 + SSL (secure: true)
  // 2. 587端口 + STARTTLS (secure: false)
  const transporter = nodemailer.createTransport({
    host: BACKUP_CONFIG.mail.host,
    port: BACKUP_CONFIG.mail.port,
    secure: BACKUP_CONFIG.mail.secure,
    auth: BACKUP_CONFIG.mail.auth,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    // 生产环境可能需要跳过SSL验证
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production' ? false : true
    }
  });

  return transporter;
}

// 测试邮件连接
async function testEmailConnection(): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) return false;

  try {
    console.log('[Backup] 测试邮件连接...');
    await transporter.verify();
    console.log('[Backup] 邮件连接测试成功');
    return true;
  } catch (error) {
    console.error('[Backup] 邮件连接测试失败:', error instanceof Error ? error.message : error);
    return false;
  }
}

// 导出数据库为 JSON
function exportToJson(dateStr: string): { success: boolean; filePath?: string; error?: string } {
  try {
    if (!fs.existsSync(dbPath)) {
      return { success: false, error: `数据库文件不存在: ${dbPath}` };
    }

    const db = new Database(dbPath, { readonly: true });
    
    const exportData = {
      exportDate: new Date().toISOString(),
      exportTimezone: 'Asia/Shanghai',
      sourcePath: dbPath,
      tables: {
        users: db.prepare('SELECT * FROM users').all(),
        appointments: db.prepare('SELECT * FROM appointments').all(),
        overdue_items: db.prepare('SELECT * FROM overdue_items').all(),
        overdue_periods: db.prepare('SELECT * FROM overdue_periods').all(),
        performance: db.prepare('SELECT * FROM performance').all()
      }
    };

    db.close();

    if (!fs.existsSync(backupDataDir)) {
      fs.mkdirSync(backupDataDir, { recursive: true });
    }

    const jsonFilePath = path.join(backupDataDir, `data-${dateStr}.json`);
    fs.writeFileSync(jsonFilePath, JSON.stringify(exportData, null, 2), 'utf-8');

    console.log(`[Backup] JSON导出成功: ${jsonFilePath}`);
    return { success: true, filePath: jsonFilePath };
  } catch (error) {
    console.error('[Backup] JSON导出失败:', error instanceof Error ? error.message : error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// 清理旧备份（保留7天）
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

// 发送备份邮件（带重试机制）
async function sendEmailBackup(timeStr: string, jsonFilePath?: string): Promise<boolean> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (attempt > 1) {
      console.log(`[Backup] 邮件发送重试 ${attempt}/${maxRetries}...`);
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }

    try {
      const transporter = getTransporter();
      if (!transporter) {
        console.log('[Backup] 邮件未配置，跳过邮件备份');
        return false;
      }

      if (!fs.existsSync(dbPath)) {
        console.error('[Backup] 数据库文件不存在，无法发送邮件');
        return false;
      }

      const attachments: any[] = [
        {
          filename: `dev-backup-${timeStr}.db`,
          path: dbPath,
          contentType: 'application/octet-stream'
        }
      ];

      if (jsonFilePath && fs.existsSync(jsonFilePath)) {
        attachments.push({
          filename: `data-${timeStr}.json`,
          path: jsonFilePath,
          contentType: 'application/json'
        });
      }

      const now = new Date();
      const info = await transporter.sendMail({
        from: BACKUP_CONFIG.mail.from,
        to: BACKUP_CONFIG.mail.to,
        subject: `[备份] 行程系统数据 ${timeStr}`,
        text: `备份时间：${now.toLocaleString('zh-CN')}\n\n数据库路径：${dbPath}\n\n附件包含：\n1. 数据库备份 (.db)\n2. 数据导出 (.json)`,
        attachments
      });

      console.log(`[Backup] 邮件发送成功: ${timeStr}, 消息ID: ${info.messageId}`);
      return true;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Backup] 邮件发送失败 (尝试 ${attempt}/${maxRetries}):`, lastError.message);
      
      // 如果是认证错误，不需要重试
      if (lastError.message.includes('535') || lastError.message.includes('auth')) {
        console.error('[Backup] 认证失败，请检查 MAIL_PASS 配置');
        break;
      }
    }
  }

  if (lastError) {
    console.error('[Backup] 邮件发送最终失败:', {
      message: lastError.message,
      code: (lastError as any).code,
      command: (lastError as any).command
    });
    console.error('[Backup] 请检查：');
    console.error('  1. CloudBase 环境变量 MAIL_USER 和 MAIL_PASS 是否已正确配置');
    console.error('  2. QQ邮箱授权码是否正确（登录 QQ邮箱 -> 设置 -> 账户 -> 开启 SMTP）');
    console.error('  3. CloudBase 是否允许出站 SMTP 连接');
  }
  
  return false;
}

// 手动复制备份到项目目录（便于随项目一起部署）
function copyBackupToProject(timeStr: string): string | null {
  try {
    if (!fs.existsSync(dbPath)) return null;
    
    const copyDir = path.join(projectRoot, 'backup');
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
  let emailSent = false;
  let jsonExported = false;
  let dbCopied = false;

  const now = new Date();
  const timeStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  console.log(`\n[Backup] ========== 开始备份 ${timeStr} ==========`);

  // 步骤1：导出 JSON
  const exportResult = exportToJson(timeStr);
  if (exportResult.success) {
    jsonExported = true;
  } else {
    errors.push(`JSON导出失败: ${exportResult.error}`);
  }

  // 步骤2：复制 .db 文件到 backup 目录
  const copyPath = copyBackupToProject(timeStr);
  if (copyPath) {
    dbCopied = true;
  } else {
    errors.push('数据库复制失败');
  }

  // 步骤3：发送邮件（包含 .db 和 .json）
  emailSent = await sendEmailBackup(timeStr, exportResult.filePath);
  if (!emailSent && BACKUP_CONFIG.mail.auth.pass) {
    errors.push('邮件发送失败');
  }

  // 步骤4：清理旧备份
  if (jsonExported) {
    cleanOldBackups();
  }

  lastBackupTime = now;
  const success = jsonExported || dbCopied || emailSent;

  const result = {
    success,
    emailSent,
    jsonExported,
    dbCopied,
    errors,
    backupTime: now.toLocaleString('zh-CN')
  };

  console.log(`[Backup] ========== 备份完成 ==========`);
  console.log(`[Backup] JSON导出: ${jsonExported ? '✓' : '✗'}`);
  console.log(`[Backup] DB复制: ${dbCopied ? '✓' : '✗'}`);
  console.log(`[Backup] 邮件发送: ${emailSent ? '✓' : '✗'}`);
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
    const dbFile = path.join(projectRoot, 'backup', `dev-backup-${dateStr}.db`);
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
  if (!fs.existsSync(backupDataDir)) {
    fs.mkdirSync(backupDataDir, { recursive: true });
  }

  const mailConfigured = !!BACKUP_CONFIG.mail.auth.pass;
  
  // 打印配置
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  数据备份服务启动                                            ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  运行环境: ${isProduction ? '生产环境' : '开发环境'}`);
  console.log(`║  云平台: ${isCloudBase ? 'CloudBase' : isEmas ? 'EMAS' : '本地'}`);
  console.log(`║  数据库: ${dbPath}`);
  console.log(`║  JSON备份: ${backupDataDir}`);
  console.log(`║  邮件备份: ${mailConfigured ? `启用 → ${BACKUP_CONFIG.mail.to}` : '未配置'}`);
  if (mailConfigured) {
    console.log(`║  SMTP配置: ${BACKUP_CONFIG.mail.host}:${BACKUP_CONFIG.mail.port} (${BACKUP_CONFIG.mail.secure ? 'SSL' : 'STARTTLS'})`);
  }
  console.log(`║  定时任务: ${BACKUP_CONFIG.cron} (每日凌晨2点)`);
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

  // 启动后测试邮件连接（异步，不阻塞启动）
  if (mailConfigured) {
    setTimeout(async () => {
      const connected = await testEmailConnection();
      if (!connected) {
        console.warn('[Backup] ⚠️  邮件连接测试失败，备份时将重试');
        console.warn('[Backup] 请检查 CloudBase 环境变量配置');
      }
    }, 2000);
  }

  console.log('[Backup] 启动后首次备份已禁用，将在定时任务触发时执行');
  console.log('[Backup] 手动备份接口仍可使用: POST /api/backup');
}

export { sendBackup, restoreFromBackup, lastBackupTime, backupDataDir };
