import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isCloudBase = process.env.CLOUDBASE_ENV === 'true';
const isEmas = process.env.EMAS_ENV === 'true';
const isProduction = process.env.NODE_ENV === 'production';
const isServerless = isCloudBase || isEmas || isProduction;

// 云原生环境使用 /mnt/data 持久化路径
const dbDir = isServerless ? '/mnt/data' : path.join(__dirname, '..');
if (isServerless) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'dev.db');

export const db = new Database(dbPath);

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
    db.prepare('INSERT INTO users (id, name, phone, password, role) VALUES (?, ?, ?, ?, ?)').run('1', '兰天翔', '111', '123', 'admin');
    db.prepare('INSERT INTO users (id, name, phone, password, role) VALUES (?, ?, ?, ?, ?)').run('2', '魏凯', '222', '123', 'sales');
  } else {
    db.prepare('UPDATE users SET phone = ?, password = ?, role = ? WHERE id = ?').run('111', '123', 'admin', '1');
    db.prepare('INSERT OR IGNORE INTO users (id, name, phone, password, role) VALUES (?, ?, ?, ?, ?)').run('2', '魏凯', '222', '123', 'sales');
  }

  const appointmentCount = db.prepare('SELECT COUNT(*) as count FROM appointments').get().count;
  if (appointmentCount === 0) {
    const appointments = [
      { id: '1', userId: '1', date: '2026-06-02', timePeriod: '上午', company: '成都安盛', type: '面谈', amount: 10000, remark: '', status: '待审核', customerName: '四川成都安盛' },
      { id: '2', userId: '1', date: '2026-06-03', timePeriod: '上午', company: '成都安盛', type: '面谈', amount: 12000, remark: '', status: '待审核', customerName: '四川成都安盛' },
      { id: '3', userId: '1', date: '2026-06-04', timePeriod: '下午', company: '成都安盛', type: '面谈', amount: 8000, remark: '', status: '待审核', customerName: '四川成都安盛' },
      { id: '4', userId: '1', date: '2026-06-05', timePeriod: '上午', company: '襄阳国寿', type: '面谈', amount: 15000, remark: '', status: '待审核', customerName: '湖北襄阳国寿' },
      { id: '5', userId: '1', date: '2026-06-06', timePeriod: '下午', company: '武汉生命', type: '面谈', amount: 18000, remark: '', status: '待审核', customerName: '湖北武汉生命' },
      { id: '6', userId: '1', date: '2026-06-07', timePeriod: '上午', company: '武汉生命', type: '面谈', amount: 5000, remark: '', status: '待审核', customerName: '湖北武汉生命' },
      { id: '7', userId: '1', date: '2026-06-08', timePeriod: '下午', company: '武汉太平', type: '面谈', amount: 20000, remark: '', status: '待审核', customerName: '湖北武汉太平' },
      { id: '8', userId: '1', date: '2026-06-09', timePeriod: '上午', company: '广州生命', type: '面谈', amount: 15000, remark: '', status: '待审核', customerName: '广东广州生命' },
      { id: '9', userId: '1', date: '2026-06-10', timePeriod: '下午', company: '昆明安盛', type: '面谈', amount: 12000, remark: '', status: '待审核', customerName: '云南昆明安盛' },
      { id: '10', userId: '1', date: '2026-06-11', timePeriod: '上午', company: '东莞建信', type: '面谈', amount: 10000, remark: '', status: '待审核', customerName: '广东东莞建信' },
      { id: '11', userId: '1', date: '2026-06-12', timePeriod: '下午', company: '武汉生命', type: '面谈', amount: 8000, remark: '', status: '待审核', customerName: '湖北武汉生命' },
      { id: '12', userId: '1', date: '2026-06-13', timePeriod: '上午', company: '梅州建信', type: '面谈', amount: 6000, remark: '', status: '待审核', customerName: '广东梅州建信' },
      { id: '13', userId: '1', date: '2026-06-14', timePeriod: '下午', company: '武汉生命', type: '面谈', amount: 14000, remark: '', status: '待审核', customerName: '湖北武汉生命' },
      { id: '14', userId: '1', date: '2026-06-15', timePeriod: '上午', company: '武汉生命', type: '面谈', amount: 16000, remark: '', status: '待审核', customerName: '湖北武汉生命' },
      { id: '15', userId: '1', date: '2026-06-15', timePeriod: '下午', company: '广州生命', type: '面谈', amount: 12000, remark: '', status: '待审核', customerName: '广东广州生命' },
      { id: '16', userId: '1', date: '2026-06-16', timePeriod: '上午', company: '上海建信', type: '面谈', amount: 20000, remark: '', status: '待审核', customerName: '上海上海建信' },
      { id: '17', userId: '1', date: '2026-06-17', timePeriod: '下午', company: '武汉生命', type: '面谈', amount: 10000, remark: '', status: '待审核', customerName: '湖北武汉生命' },
      { id: '18', userId: '1', date: '2026-06-24', timePeriod: '上午', company: '广州生命', type: '面谈', amount: 15000, remark: '', status: '待审核', customerName: '广东广州生命' },
      { id: '19', userId: '1', date: '2026-06-25', timePeriod: '下午', company: '武汉人保', type: '面谈', amount: 8800, remark: '', status: '待审核', customerName: '湖北武汉人保' },
    ];

    const insertStmt = db.prepare(`
      INSERT INTO appointments (id, userId, date, timePeriod, company, type, amount, remark, status, customerName, paymentStatus, teacherId, teacher)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    appointments.forEach(app => {
      insertStmt.run(
        app.id,
        app.userId,
        app.date,
        app.timePeriod,
        app.company,
        app.type,
        app.amount,
        app.remark,
        app.status,
        app.customerName,
        '未回款',
        app.userId,
        '兰天翔'
      );
    });
  }

  const overdueCount = db.prepare('SELECT COUNT(*) as count FROM overdue_items').get().count;
  if (overdueCount === 0) {
    const overdueItems = [
      { id: '1', userId: '1', company: '深圳深圳保诚', count: 5, amount: 97500, overdueType: '超半年' },
      { id: '2', userId: '1', company: '广东珠海建信', count: 15, amount: 180600, overdueType: '超半年' },
      { id: '3', userId: '1', company: '广东惠州建信', count: 2, amount: 25100, overdueType: '超半年' },
      { id: '4', userId: '1', company: '广东肇庆建信', count: 1, amount: 25000, overdueType: '超半年' },
      { id: '5', userId: '1', company: '上海上海安盛', count: 14, amount: 141000, overdueType: '超半年' },
      { id: '6', userId: '1', company: '广东广州建信', count: 1, amount: 25000, overdueType: '半年内' },
      { id: '7', userId: '1', company: '上海上海建信', count: 5, amount: 62500, overdueType: '混合' },
      { id: '8', userId: '1', company: '浙江衢州建信', count: 1, amount: 25000, overdueType: '三月内' },
      { id: '9', userId: '1', company: '浙江丽水建信', count: 2, amount: 50000, overdueType: '三月内' },
    ];

    const insertStmt = db.prepare(`
      INSERT INTO overdue_items (id, userId, company, count, amount, overdueType)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    overdueItems.forEach(item => {
      insertStmt.run(item.id, item.userId, item.company, item.count, item.amount, item.overdueType);
    });

    const periods = [
      { id: 'p1', overdueId: '1', label: '超半年', count: 5, amount: 97500 },
      { id: 'p2', overdueId: '2', label: '超半年', count: 15, amount: 180600 },
      { id: 'p3', overdueId: '3', label: '超半年', count: 2, amount: 25100 },
      { id: 'p4', overdueId: '4', label: '超半年', count: 1, amount: 25000 },
      { id: 'p5', overdueId: '5', label: '超半年', count: 14, amount: 141000 },
      { id: 'p6', overdueId: '6', label: '半年内', count: 1, amount: 25000 },
      { id: 'p7', overdueId: '7', label: '一月内', count: 3, amount: 37500 },
      { id: 'p8', overdueId: '7', label: '三月内', count: 1, amount: 12500 },
      { id: 'p9', overdueId: '7', label: '半年内', count: 1, amount: 12500 },
      { id: 'p10', overdueId: '8', label: '三月内', count: 1, amount: 25000 },
      { id: 'p11', overdueId: '9', label: '三月内', count: 2, amount: 50000 },
    ];

    const insertPeriodStmt = db.prepare(`
      INSERT INTO overdue_periods (id, overdueId, label, count, amount)
      VALUES (?, ?, ?, ?, ?)
    `);

    periods.forEach(p => {
      insertPeriodStmt.run(p.id, p.overdueId, p.label, p.count, p.amount);
    });
  }

  const performanceCount = db.prepare('SELECT COUNT(*) as count FROM performance').get().count;
  if (performanceCount === 0) {
    const performances = [
      { id: '1', userId: '1', orderDate: '2026-06-01', invoiceDate: '2026-06-05', paymentDate: '2026-06-10', amount: 10000, bonus: 500, company: '客户A' },
      { id: '2', userId: '1', orderDate: '2026-06-02', invoiceDate: '2026-06-06', paymentDate: '2026-06-12', amount: 20000, bonus: 1000, company: '客户B' },
      { id: '3', userId: '1', orderDate: '2026-06-03', invoiceDate: '2026-06-08', paymentDate: '2026-06-15', amount: 15000, bonus: 750, company: '客户C' },
      { id: '4', userId: '1', orderDate: '2026-06-05', invoiceDate: '2026-06-10', paymentDate: '2026-06-18', amount: 25000, bonus: 1250, company: '客户D' },
      { id: '5', userId: '1', orderDate: '2026-06-08', invoiceDate: '2026-06-12', paymentDate: '2026-06-20', amount: 30000, bonus: 1500, company: '客户E' },
    ];

    const insertStmt = db.prepare(`
      INSERT INTO performance (id, userId, orderDate, invoiceDate, paymentDate, amount, bonus, company)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    performances.forEach(p => {
      insertStmt.run(p.id, p.userId, p.orderDate, p.invoiceDate, p.paymentDate, p.amount, p.bonus, p.company);
    });
  }
}
