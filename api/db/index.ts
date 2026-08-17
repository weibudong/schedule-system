import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库路径：始终使用 api/dev.db
// __dirname 是 api/db/，需要 .. 才能到 api/
// 本地开发: api/dev.db
// 生产环境: /app/api/dev.db
const dbPath = path.join(__dirname, '..', 'dev.db');
console.log('[DB] 数据库路径:', dbPath);

let db = new Database(dbPath);

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
