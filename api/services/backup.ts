import cron from 'node-cron';
import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isCloudBase = process.env.CLOUDBASE_ENV === 'true';
const dbPath = isCloudBase ? '/mnt/data/dev.db' : path.join(__dirname, 'db', 'dev.db');

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
  }
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

async function sendBackup() {
  const transporter = getTransporter();
  if (!transporter) return;

  try {
    if (!fs.existsSync(dbPath)) {
      console.error('[Backup] Database file not found:', dbPath);
      return;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const fileName = `dev-backup-${dateStr}.db`;

    await transporter.sendMail({
      from: BACKUP_CONFIG.mail.from,
      to: BACKUP_CONFIG.mail.to,
      subject: `[每日备份] 行程管理系统数据库 ${dateStr}`,
      text: `这是 ${dateStr} 的数据库自动备份文件。\n\n备份时间：${now.toLocaleString('zh-CN')}\n数据库路径：${dbPath}`,
      attachments: [
        {
          filename: fileName,
          path: dbPath,
          contentType: 'application/octet-stream'
        }
      ]
    });

    console.log(`[Backup] Database backup sent successfully: ${fileName}`);
  } catch (error) {
    console.error('[Backup] Failed to send backup:', error instanceof Error ? error.message : error);
  }
}

export function startBackupCron() {
  if (!BACKUP_CONFIG.mail.auth.pass) {
    console.warn('[Backup] MAIL_PASS not set, backup cron disabled. Set MAIL_PASS to enable.');
    console.warn('[Backup] QQ Mail auth code: login QQ mail -> Settings -> Account -> Enable SMTP -> get auth code');
    return;
  }

  cron.schedule(BACKUP_CONFIG.cron, async () => {
    console.log('[Backup] Running scheduled database backup...');
    await sendBackup();
  }, {
    timezone: 'Asia/Shanghai'
  });

  console.log(`[Backup] Cron started: daily at 02:00 AM (Asia/Shanghai)`);
  console.log(`[Backup] To: ${BACKUP_CONFIG.mail.to}`);
}

export { sendBackup };
