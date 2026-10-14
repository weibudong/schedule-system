import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== 存储路径解析 =====
// CloudBase 云托管：CFS 文件存储挂载到容器内某路径（控制台配置，默认为 /mnt），
// 数据写入该目录后，重新部署/实例重建数据不丢失，且可在 CFS 文件列表中看到。
// 本地开发：无网络挂载，回退到项目内目录（api/dev.db、data/、backup/）。
// 可用环境变量 DATA_MOUNT_DIR 显式指定挂载点（最高优先级）。
//
// 注意：不能用「目录是否存在」判断挂载点——Dockerfile/启动脚本会在容器本地盘
// 创建同名目录（如 /mnt/data），existsSync 恒为 true 会导致数据误写到容器临时层。
// 必须通过 /proc/mounts（nfs/nfs4/cifs 等网络文件系统）或设备号差异识别真实挂载点。
const projectRoot = path.join(__dirname, '..', '..');

// 网络/持久化文件系统类型（CFS 基于 NFS）
const NETWORK_FS_TYPES = new Set(['nfs', 'nfs4', 'cifs', 'smbfs', 'cfs', 'fuse.cfs', 'fuse.tencent-cfs']);

interface MountInfo {
  device: string;
  target: string;
  type: string;
}

// 读取 /proc/mounts 中的挂载信息
function readMounts(): MountInfo[] {
  try {
    const content = fs.readFileSync('/proc/mounts', 'utf-8');
    return content
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [device, target, type] = line.split(' ');
        return { device: device || '', target: target ? decodeURIComponent(target) : '', type: type || '' };
      })
      .filter(m => m.target);
  } catch {
    return [];
  }
}

const allMounts = readMounts();
const networkMounts = allMounts.filter(m => NETWORK_FS_TYPES.has(m.type));

// 判断路径是否位于网络挂载点之上（路径本身是挂载点，或在挂载点子目录内）
function isOnNetworkMount(p: string): boolean {
  const resolved = path.resolve(p);
  return networkMounts.some(m => resolved === m.target || resolved.startsWith(m.target + '/'));
}

// 判断路径是否为挂载点（设备号与父目录不同，覆盖 bind mount 等情况）
function isMountPointByDev(p: string): boolean {
  try {
    const resolved = path.resolve(p);
    if (resolved === '/') return false;
    const st = fs.statSync(resolved);
    const parentSt = fs.statSync(path.dirname(resolved));
    return st.dev !== parentSt.dev;
  } catch {
    return false;
  }
}

function dirUsable(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

// 解析持久化挂载目录：环境变量 > 常见挂载点候选
// CloudBase 云托管 CFS 默认挂载路径为 /mnt；也有用户配成 /mnt/data、/mnt/cfs、/data 等
function resolveMountDir(): string | null {
  if (process.env.CLOUDBASE_ENV !== 'true' && !process.env.DATA_MOUNT_DIR) return null;

  const candidates: string[] = [];
  if (process.env.DATA_MOUNT_DIR) candidates.push(process.env.DATA_MOUNT_DIR);
  candidates.push('/mnt', '/mnt/data', '/mnt/cfs', '/data', '/cfs', '/mnt/data/cfs');

  for (const c of candidates) {
    if (!dirUsable(c)) continue;
    if (isOnNetworkMount(c) || isMountPointByDev(c)) {
      return path.resolve(c);
    }
  }
  return null;
}

const mountDir = resolveMountDir();
const useMount = mountDir !== null;

// 数据库文件
const localDbPath = path.join(__dirname, '..', 'dev.db');
const mountDbPath = mountDir ? path.join(mountDir, 'dev.db') : '';
export const dbPath = useMount ? mountDbPath : localDbPath;

// JSON 备份导出目录
const localDataDir = path.join(projectRoot, 'data');
export const backupDataDir = useMount ? path.join(mountDir!, 'data') : localDataDir;

// .db 文件备份目录
const localBackupDir = path.join(projectRoot, 'backup');
export const dbBackupDir = useMount ? path.join(mountDir!, 'backup') : localBackupDir;

export const storageLocation = useMount ? `bucket:${mountDir}` : 'local';

// 诊断信息（供 /api/backup/status、/api/health 上报，便于部署后核对）
export const storageDiagnostics = {
  storageLocation,
  mountDir,
  dbPath: useMount ? mountDbPath : localDbPath,
  backupDataDir: useMount ? path.join(mountDir!, 'data') : localDataDir,
  dbBackupDir: useMount ? path.join(mountDir!, 'backup') : localBackupDir,
  networkMounts: networkMounts.map(m => `${m.type} ${m.device} -> ${m.target}`),
  cloudbaseEnv: process.env.CLOUDBASE_ENV === 'true',
  envDataMountDir: process.env.DATA_MOUNT_DIR || null
};

// 首次以挂载模式启动时，把容器内旧数据迁移到持久化目录（仅当目标中尚不存在对应文件）
function migrateLegacyData() {
  if (!useMount || !mountDir) return;
  try {
    fs.mkdirSync(path.join(mountDir, 'data'), { recursive: true });
    fs.mkdirSync(path.join(mountDir, 'backup'), { recursive: true });

    // 旧数据库 /app/api/dev.db -> <挂载点>/dev.db
    if (!fs.existsSync(mountDbPath) && fs.existsSync(localDbPath) && fs.statSync(localDbPath).size > 0) {
      fs.copyFileSync(localDbPath, mountDbPath);
      console.log('[DB] 已迁移容器内旧数据库到持久化存储:', mountDbPath);
    }

    // 旧 JSON 备份 /app/data/*.json -> <挂载点>/data/
    if (fs.existsSync(localDataDir)) {
      fs.readdirSync(localDataDir)
        .filter(f => f.startsWith('data-') && f.endsWith('.json'))
        .forEach(f => {
          const target = path.join(mountDir, 'data', f);
          if (!fs.existsSync(target)) fs.copyFileSync(path.join(localDataDir, f), target);
        });
    }

    // 旧 .db 备份 /app/backup/*.db -> <挂载点>/backup/
    if (fs.existsSync(localBackupDir)) {
      fs.readdirSync(localBackupDir)
        .filter(f => f.endsWith('.db'))
        .forEach(f => {
          const target = path.join(mountDir, 'backup', f);
          if (!fs.existsSync(target)) fs.copyFileSync(path.join(localBackupDir, f), target);
        });
    }
  } catch (e) {
    console.warn('[DB] 旧数据迁移失败（不影响启动）:', (e as Error).message);
  }
}

migrateLegacyData();

console.log('[DB] ============================================');
console.log('[DB] 存储位置:', storageLocation);
if (useMount) {
  console.log('[DB] 持久化挂载点:', mountDir);
  console.log('[DB] 检测到的网络挂载:', storageDiagnostics.networkMounts.length ? storageDiagnostics.networkMounts.join(' | ') : '（通过设备号识别）');
} else if (process.env.CLOUDBASE_ENV === 'true') {
  console.warn('[DB] ⚠️  ⚠️  ⚠️  未检测到 CFS 持久化挂载！数据将写入容器临时磁盘，重新部署后会丢失！');
  console.warn('[DB] 请在 CloudBase 控制台「服务详情 → 存储挂载」启用 CFS，或设置环境变量 DATA_MOUNT_DIR 为实际挂载路径');
  console.warn('[DB] 当前识别到的网络挂载:', storageDiagnostics.networkMounts.length ? storageDiagnostics.networkMounts.join(' | ') : '无');
}
console.log('[DB] 数据库路径:', dbPath);
console.log('[DB] ============================================');

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
    db.prepare('INSERT INTO users (id, name, phone, password, role) VALUES (?, ?, ?, ?, ?)').run('2', '熊娟', '15972212660', '123', 'admin');
    db.prepare('INSERT INTO users (id, name, phone, password, role) VALUES (?, ?, ?, ?, ?)').run('3', '兰天翔', '15972212880', '123', 'sales');
  } else {
    db.prepare('UPDATE users SET phone = ?, password = ?, role = ? WHERE id = ?').run('13026151270', '123', 'admin', '1');
    db.prepare('INSERT OR IGNORE INTO users (id, name, phone, password, role) VALUES (?, ?, ?, ?, ?)').run('2', '熊娟', '15972212660', '123', 'admin');
    db.prepare('INSERT OR IGNORE INTO users (id, name, phone, password, role) VALUES (?, ?, ?, ?, ?)').run('3', '兰天翔', '15972212880', '123', 'sales');
  }

  // 种子账号手机号更新：仅当仍是初始号码时更新，不覆盖管理员后续修改过的号码
  db.prepare("UPDATE users SET phone = ? WHERE id = ? AND phone = ?").run('15972212660', '2', '222');
  db.prepare("UPDATE users SET phone = ? WHERE id = ? AND phone = ?").run('15972212880', '3', '333');

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
