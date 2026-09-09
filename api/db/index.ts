import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== 存储路径解析 =====
// CloudBase 云托管：储存桶（CFS 持久化存储）挂载在 /mnt/data，
// 数据写入该目录后，重新部署/实例重建数据不丢失，且可在储存桶文件列表中看到。
// 本地开发：储存桶不存在，回退到项目内目录（api/dev.db、data/、backup/）。
// 可用环境变量 DATA_MOUNT_DIR 覆盖挂载点（便于本地测试）。
const MOUNT_DIR = process.env.DATA_MOUNT_DIR || '/mnt/data';
const projectRoot = path.join(__dirname, '..', '..');

function mountAvailable(): boolean {
  if (process.env.CLOUDBASE_ENV !== 'true') return false;
  try {
    return fs.existsSync(MOUNT_DIR) && fs.statSync(MOUNT_DIR).isDirectory();
  } catch {
    return false;
  }
}

const useMount = mountAvailable();

// 数据库文件
const localDbPath = path.join(__dirname, '..', 'dev.db');
const mountDbPath = path.join(MOUNT_DIR, 'dev.db');
export const dbPath = useMount ? mountDbPath : localDbPath;

// JSON 备份导出目录
const localDataDir = path.join(projectRoot, 'data');
export const backupDataDir = useMount ? path.join(MOUNT_DIR, 'data') : localDataDir;

// .db 文件备份目录
const localBackupDir = path.join(projectRoot, 'backup');
export const dbBackupDir = useMount ? path.join(MOUNT_DIR, 'backup') : localBackupDir;

export const storageLocation = useMount ? `bucket:${MOUNT_DIR}` : 'local';

// 首次以储存桶模式启动时，把容器内旧数据迁移到桶里（仅当桶中尚不存在对应文件）
function migrateLegacyData() {
  if (!useMount) return;
  try {
    fs.mkdirSync(path.join(MOUNT_DIR, 'data'), { recursive: true });
    fs.mkdirSync(path.join(MOUNT_DIR, 'backup'), { recursive: true });

    // 旧数据库 /app/api/dev.db -> /mnt/data/dev.db
    if (!fs.existsSync(mountDbPath) && fs.existsSync(localDbPath) && fs.statSync(localDbPath).size > 0) {
      fs.copyFileSync(localDbPath, mountDbPath);
      console.log('[DB] 已迁移容器内旧数据库到储存桶:', mountDbPath);
    }

    // 旧 JSON 备份 /app/data/*.json -> /mnt/data/data/
    if (fs.existsSync(localDataDir)) {
      fs.readdirSync(localDataDir)
        .filter(f => f.startsWith('data-') && f.endsWith('.json'))
        .forEach(f => {
          const target = path.join(MOUNT_DIR, 'data', f);
          if (!fs.existsSync(target)) fs.copyFileSync(path.join(localDataDir, f), target);
        });
    }

    // 旧 .db 备份 /app/backup/*.db -> /mnt/data/backup/
    if (fs.existsSync(localBackupDir)) {
      fs.readdirSync(localBackupDir)
        .filter(f => f.endsWith('.db'))
        .forEach(f => {
          const target = path.join(MOUNT_DIR, 'backup', f);
          if (!fs.existsSync(target)) fs.copyFileSync(path.join(localBackupDir, f), target);
        });
    }
  } catch (e) {
    console.warn('[DB] 旧数据迁移到储存桶失败（不影响启动）:', (e as Error).message);
  }
}

migrateLegacyData();

console.log('[DB] 存储位置:', storageLocation);
console.log('[DB] 数据库路径:', dbPath);

function applyPragmas(database: Database.Database) {
  // CFS 为网络文件存储，不使用 WAL（避免跨实例锁问题），保持默认 rollback journal
  database.pragma('journal_mode = DELETE');
  database.pragma('busy_timeout = 5000');
  database.pragma('synchronous = NORMAL');
}

let db = new Database(dbPath);
applyPragmas(db);

export function getDb() {
  return db;
}

export function reconnectDb() {
  console.log('[DB] 重新连接数据库:', dbPath);
  try {
    db.close();
  } catch (e) {
    // 忽略关闭错误
  }
  db = new Database(dbPath);
  applyPragmas(db);
  console.log('[DB] 数据库重连成功');
  return db;
}

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      password TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'sales'
    );
    
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      date TEXT NOT NULL,
      timePeriod TEXT NOT NULL DEFAULT '上午',
      company TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      remark TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '待审核',
      customerName TEXT NOT NULL,
      paymentStatus TEXT NOT NULL DEFAULT '未回款',
      invoiceStatus TEXT NOT NULL DEFAULT '未开票',
      invoiceDate TEXT,
      invoiceNo TEXT,
      paymentDate TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS overdue_items (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      company TEXT NOT NULL,
      count INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      overdueType TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS overdue_periods (
      id TEXT PRIMARY KEY,
      overdueId TEXT NOT NULL,
      label TEXT NOT NULL,
      count INTEGER NOT NULL,
      amount INTEGER NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS performance (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      orderDate TEXT,
      invoiceDate TEXT,
      paymentDate TEXT,
      amount INTEGER NOT NULL DEFAULT 0,
      bonus INTEGER NOT NULL DEFAULT 0,
      company TEXT,
      type TEXT NOT NULL DEFAULT '面谈'
    );
  `);

  const columns = db.prepare("PRAGMA table_info(appointments)").all();
  const hasPaymentStatus = columns.some((col: any) => col.name === 'paymentStatus');
  if (!hasPaymentStatus) {
    db.exec("ALTER TABLE appointments ADD COLUMN paymentStatus TEXT NOT NULL DEFAULT '未回款'");
  }
  const hasInvoiceStatus = columns.some((col: any) => col.name === 'invoiceStatus');
  if (!hasInvoiceStatus) {
    db.exec("ALTER TABLE appointments ADD COLUMN invoiceStatus TEXT NOT NULL DEFAULT '未开票'");
  }
  const hasInvoiceDate = columns.some((col: any) => col.name === 'invoiceDate');
  if (!hasInvoiceDate) {
    db.exec("ALTER TABLE appointments ADD COLUMN invoiceDate TEXT");
  }
  const hasInvoiceNo = columns.some((col: any) => col.name === 'invoiceNo');
  if (!hasInvoiceNo) {
    db.exec("ALTER TABLE appointments ADD COLUMN invoiceNo TEXT");
  }
  const hasPaymentDate = columns.some((col: any) => col.name === 'paymentDate');
  if (!hasPaymentDate) {
    db.exec("ALTER TABLE appointments ADD COLUMN paymentDate TEXT");
  }
  const hasProvince = columns.some((col: any) => col.name === 'province');
  if (!hasProvince) {
    db.exec("ALTER TABLE appointments ADD COLUMN province TEXT");
  }
  const hasCity = columns.some((col: any) => col.name === 'city');
  if (!hasCity) {
    db.exec("ALTER TABLE appointments ADD COLUMN city TEXT");
  }
  const hasTeacherId = columns.some((col: any) => col.name === 'teacherId');
  if (!hasTeacherId) {
    db.exec("ALTER TABLE appointments ADD COLUMN teacherId TEXT NOT NULL DEFAULT ''");
  }
  const hasTeacher = columns.some((col: any) => col.name === 'teacher');
  if (!hasTeacher) {
    db.exec("ALTER TABLE appointments ADD COLUMN teacher TEXT NOT NULL DEFAULT ''");
  }
  
  const existingAppts = db.prepare('SELECT id, userId FROM appointments WHERE teacherId = \'\' OR teacher = \'\'').all();
  existingAppts.forEach((appt: any) => {
    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(appt.userId);
    if (user) {
      db.prepare('UPDATE appointments SET teacherId = ?, teacher = ? WHERE id = ?').run(appt.userId, user.name, appt.id);
    }
  });

  const userColumns = db.prepare("PRAGMA table_info(users)").all();
  const hasPhone = userColumns.some((col: any) => col.name === 'phone');
  const hasPassword = userColumns.some((col: any) => col.name === 'password');
  if (!hasPhone) {
    db.exec("ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT ''");
  }
  if (!hasPassword) {
    db.exec("ALTER TABLE users ADD COLUMN password TEXT NOT NULL DEFAULT ''");
  }

  const performanceColumns = db.prepare("PRAGMA table_info(performance)").all();
  const hasType = performanceColumns.some((col: any) => col.name === 'type');
  if (!hasType) {
    db.exec("ALTER TABLE performance ADD COLUMN type TEXT NOT NULL DEFAULT '面谈'");
  }

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    db.prepare('INSERT INTO users (id, name, phone, password, role) VALUES (?, ?, ?, ?, ?)').run('1', '魏凯', '13026151270', '123', 'admin');
    db.prepare('INSERT INTO users (id, name, phone, password, role) VALUES (?, ?, ?, ?, ?)').run('2', '熊娟', '222', '123', 'admin');
    db.prepare('INSERT INTO users (id, name, phone, password, role) VALUES (?, ?, ?, ?, ?)').run('3', '兰天翔', '333', '123', 'sales');
  } else {
    db.prepare('UPDATE users SET phone = ?, password = ?, role = ? WHERE id = ?').run('13026151270', '123', 'admin', '1');
    db.prepare('INSERT OR IGNORE INTO users (id, name, phone, password, role) VALUES (?, ?, ?, ?, ?)').run('2', '熊娟', '222', '123', 'admin');
    db.prepare('INSERT OR IGNORE INTO users (id, name, phone, password, role) VALUES (?, ?, ?, ?, ?)').run('3', '兰天翔', '333', '123', 'sales');
  }

  // 行程数据初始化已注释，用户要求清空行程数据
  // const appointmentCount = db.prepare('SELECT COUNT(*) as count FROM appointments').get().count;
  // if (appointmentCount === 0) {
  //   // 行程数据初始化代码已移除
  // }

  // 逾期数据和业绩数据初始化已注释，用户要求清空这些数据
  // const overdueCount = db.prepare('SELECT COUNT(*) as count FROM overdue_items').get().count;
  // if (overdueCount === 0) {
  //   // 逾期数据初始化代码已移除
  // }

  // const performanceCount = db.prepare('SELECT COUNT(*) as count FROM performance').get().count;
  // if (performanceCount === 0) {
  //   // 业绩数据初始化代码已移除
  // }
}
