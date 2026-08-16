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
const dbPath = isServerless ? '/mnt/data/dev.db' : path.join(__dirname, '..', 'dev.db');

// 项目根目录
const projectRoot = isServerless ? '/mnt' : path.join(__dirname, '..', '..');

// 备份数据目录
const backupDataDir = path.join(projectRoot, 'data');

const BACKUP_CONFIG = {
  cron: '0 2 * * *',
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

function getTransporter() {
  if (!BACKUP_CONFIG.mail.auth.pass) {
    console.warn('[Backup] MAIL_PASS not configured, backup feature disabled');
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
    
    // 导出所有表数据
    const exportData = {
      exportDate: new Date().toISOString(),
      exportTimezone: 'Asia/Shanghai',
      tables: {} as Record<string, any[]>
    };

    // 导出 users 表
    exportData.tables.users = db.prepare('SELECT * FROM users').all();
    
    // 导出 appointments 表
    exportData.tables.appointments = db.prepare('SELECT * FROM appointments').all();
    
    // 导出 overdue_items 表
    exportData.tables.overdue_items = db.prepare('SELECT * FROM overdue_items').all();
    
    // 导出 overdue_periods 表
    exportData.tables.overdue_periods = db.prepare('SELECT * FROM overdue_periods').all();
    
    // 导出 performance 表
    exportData.tables.performance = db.prepare('SELECT * FROM performance').all();

    db.close();

    // 确保备份目录存在
    if (!fs.existsSync(backupDataDir)) {
      fs.mkdirSync(backupDataDir, { recursive: true });
    }

    // 保存为 JSON 文件
    const jsonFilePath = path.join(backupDataDir, `data-${dateStr}.json`);
    fs.writeFileSync(jsonFilePath, JSON.stringify(exportData, null, 2), 'utf-8');

    console.log(`[Backup] Data exported to JSON: ${jsonFilePath}`);
    return { success: true, filePath: jsonFilePath };
  } catch (error) {
    console.error('[Backup] Failed to export JSON:', error instanceof Error ? error.message : error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// 推送备份数据到 Git 仓库
function pushToGit(dateStr: string): { success: boolean; error?: string } {
  try {
    if (!BACKUP_CONFIG.enableGitPush) {
      console.log('[Backup] Git push disabled');
      return { success: false, error: 'Git push disabled' };
    }

    // 检查是否在 Git 仓库中
    try {
      execSync('git rev-parse --is-inside-work-tree', { cwd: projectRoot, stdio: 'pipe' });
    } catch {
      console.log('[Backup] Not in a Git repository, skipping git push');
      return { success: false, error: 'Not in a Git repository' };
    }

    // 将所有 data-*.json 文件添加到 Git
    const dataDirPath = path.join(projectRoot, 'data');
    if (fs.existsSync(dataDirPath)) {
      execSync('git add data/', { cwd: projectRoot, stdio: 'pipe' });
      
      // 提交更改
      const commitMessage = `[自动备份] 数据备份 ${dateStr}`;
      execSync(`git commit -m "${commitMessage}" --allow-empty`, { cwd: projectRoot, stdio: 'pipe' });
      
      // 推送到远程
      try {
        execSync('git push origin main', { 
          cwd: projectRoot, 
          stdio: 'pipe',
          timeout: 30000 
        });
        console.log(`[Backup] Data pushed to Git remote successfully`);
        return { success: true };
      } catch (pushError) {
        const errMsg = pushError instanceof Error ? pushError.message : String(pushError);
        console.warn(`[Backup] Git push failed: ${errMsg}`);
        return { success: false, error: `Git push failed: ${errMsg}` };
      }
    } else {
      return { success: false, error: 'No data directory found' };
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[Backup] Git operation failed:', errMsg);
    return { success: false, error: errMsg };
  }
}

async function sendBackup(): Promise<{ success: boolean; emailSent: boolean; jsonExported: boolean; gitPushed: boolean; errors: string[] }> {
  const errors: string[] = [];
  let emailSent = false;
  let jsonExported = false;
  let gitPushed = false;

  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  // 步骤1：导出 JSON 数据
  const exportResult = exportToJson(dateStr);
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
        errors.push('数据库文件不存在，无法发送邮件');
      } else {
        const fileName = `dev-backup-${dateStr}.db`;
        
        const attachments: any[] = [
          {
            filename: fileName,
            path: dbPath,
            contentType: 'application/octet-stream'
          }
        ];

        // 如果 JSON 导出成功，也附上 JSON 文件
        if (exportResult.success && exportResult.filePath) {
          attachments.push({
            filename: `data-${dateStr}.json`,
            path: exportResult.filePath,
            contentType: 'application/json'
          });
        }

        await transporter.sendMail({
          from: BACKUP_CONFIG.mail.from,
          to: BACKUP_CONFIG.mail.to,
          subject: `[每日备份] 行程管理系统数据库 ${dateStr}`,
          text: `这是 ${dateStr} 的数据库自动备份文件。\n\n备份时间：${now.toLocaleString('zh-CN')}\n数据库路径：${dbPath}\n\n附件包含：\n1. 完整数据库备份 (.db)\n2. 数据导出文件 (.json)`,
          attachments
        });

        emailSent = true;
        console.log(`[Backup] Email sent successfully: ${fileName}`);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      errors.push(`邮件发送失败: ${errMsg}`);
      console.error('[Backup] Failed to send email:', errMsg);
    }
  }

  // 步骤3：推送到 Git
  if (jsonExported) {
    const gitResult = pushToGit(dateStr);
    if (gitResult.success) {
      gitPushed = true;
    } else {
      errors.push(`Git推送失败: ${gitResult.error}`);
      console.warn(`[Backup] Git push: ${gitResult.error}`);
    }
  }

  const success = emailSent || jsonExported;
  
  return { 
    success, 
    emailSent, 
    jsonExported, 
    gitPushed,
    errors 
  };
}

export function startBackupCron() {
  if (!BACKUP_CONFIG.mail.auth.pass) {
    console.warn('[Backup] MAIL_PASS not set, backup cron disabled. Set MAIL_PASS to enable.');
    console.warn('[Backup] QQ Mail auth code: login QQ mail -> Settings -> Account -> Enable SMTP -> get auth code');
  }

  // 确保数据目录存在
  if (!fs.existsSync(backupDataDir)) {
    fs.mkdirSync(backupDataDir, { recursive: true });
  }

  cron.schedule(BACKUP_CONFIG.cron, async () => {
    console.log('[Backup] Running scheduled database backup...');
    const result = await sendBackup();
    console.log('[Backup] Result:', JSON.stringify(result));
  }, {
    timezone: 'Asia/Shanghai'
  });

  console.log(`[Backup] Cron started: daily at 02:00 AM (Asia/Shanghai)`);
  console.log(`[Backup] To: ${BACKUP_CONFIG.mail.to}`);
  console.log(`[Backup] JSON export dir: ${backupDataDir}`);
  console.log(`[Backup] Git push: ${BACKUP_CONFIG.enableGitPush ? 'enabled' : 'disabled'}`);
}

export { sendBackup };