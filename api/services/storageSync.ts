/**
 * 对象存储（CloudBase 云存储）数据库快照同步
 *
 * 背景：云托管容器磁盘是临时层，实例重建 / 缩容到 0 / 重新部署都会清空 /app 下的数据。
 * 思路：容器内仍用 SQLite 高速读写（现有代码零改动），把数据库快照同步到对象存储做持久化。
 *   - 启动       ：从对象存储下载快照，恢复本地 db 文件
 *   - 数据变更   ：debounce 后上传快照（用 VACUUM INTO 生成一致性快照，避免上传半写状态的库）
 *   - 定时兜底   ：即使没有写请求也定期上传
 *   - 进程退出   ：SIGTERM / SIGINT 时强制上传一次
 *
 * 注意：SQLite 无法直接在对象存储上随机读写，所以是「本地读写 + 云端快照」而非直接挂载。
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const CLOUD_PATH = process.env.DB_SNAPSHOT_CLOUD_PATH || 'db/dev.db';
const UPLOAD_DEBOUNCE_MS = Number(process.env.DB_SNAPSHOT_DEBOUNCE_MS || 3000);

export function isStorageSyncEnabled(): boolean {
  const flag = process.env.STORAGE_SYNC_ENABLED;
  if (flag === 'false') return false;
  if (flag === 'true') return true;
  // 默认只在云托管生产环境启用，本地开发不启用
  return process.env.CLOUDBASE_ENV === 'true' || process.env.EMAS_ENV === 'true';
}

export const storageSyncState = {
  enabled: isStorageSyncEnabled(),
  cloudPath: CLOUD_PATH,
  sdkReady: false,
  initError: null as string | null,
  fileId: process.env.DB_SNAPSHOT_FILE_ID || null as string | null,
  lastUploadAt: null as string | null,
  lastUploadError: null as string | null,
  lastDownloadAt: null as string | null,
  lastDownloadError: null as string | null,
  uploadCount: 0,
  lastUploadBytes: 0
};

let app: any = null;
let appInitTried = false;

function getApp(): any {
  if (appInitTried) return app;
  appInitTried = true;
  try {
    const tcb = require('@cloudbase/node-sdk');
    const env =
      process.env.CBR_ENV_ID ||
      process.env.CLOUDBASE_ENV_ID ||
      process.env.TCB_ENV ||
      undefined;

    const opts: Record<string, string> = {};
    if (env) opts.env = env;
    // 若容器内注入了固定/临时密钥则显式传入，否则依赖云托管默认鉴权（自动读环境变量）
    if (process.env.TENCENTCLOUD_SECRETID && process.env.TENCENTCLOUD_SECRETKEY) {
      opts.secretId = process.env.TENCENTCLOUD_SECRETID;
      opts.secretKey = process.env.TENCENTCLOUD_SECRETKEY;
      if (process.env.TENCENTCLOUD_SESSIONTOKEN) {
        opts.sessionToken = process.env.TENCENTCLOUD_SESSIONTOKEN;
      }
    }

    app = tcb.init(opts);
    storageSyncState.sdkReady = true;
    console.log(`[StorageSync] CloudBase SDK 就绪, env=${env || '(自动)'} cloudPath=${CLOUD_PATH}`);
    if (!storageSyncState.fileId) {
      console.warn(
        '[StorageSync] 未配置 DB_SNAPSHOT_FILE_ID：本次不会自动恢复云端数据。' +
          '首次上传成功后请把日志里的 fileID 配到环境变量 DB_SNAPSHOT_FILE_ID，之后实例重建即可自动恢复。'
      );
    }
  } catch (e) {
    storageSyncState.initError = (e as Error).message;
    console.warn('[StorageSync] SDK 初始化失败，对象存储同步停用:', storageSyncState.initError);
  }
  return app;
}

/**
 * 生成一致性快照。直接复制正在写入的 db 文件可能得到损坏的库，
 * VACUUM INTO 会在单个事务内产出一个完整可用的副本。
 */
function makeSnapshot(db: any, snapshotPath: string): void {
  if (fs.existsSync(snapshotPath)) fs.unlinkSync(snapshotPath);
  db.exec(`VACUUM INTO '${snapshotPath.replace(/'/g, "''")}'`);
}

export async function uploadSnapshot(db: any): Promise<{ ok: boolean; fileID?: string; error?: string }> {
  if (!isStorageSyncEnabled()) return { ok: false, error: '同步未启用' };
  const client = getApp();
  if (!client) return { ok: false, error: storageSyncState.initError || 'SDK 未就绪' };

  const snapshotPath = path.join(os.tmpdir(), `db-snapshot-${process.pid}-${Date.now()}.db`);
  try {
    makeSnapshot(db, snapshotPath);
    const stat = fs.statSync(snapshotPath);
    const res = await client.uploadFile({
      cloudPath: CLOUD_PATH,
      fileContent: fs.createReadStream(snapshotPath)
    });

    storageSyncState.lastUploadAt = new Date().toISOString();
    storageSyncState.lastUploadError = null;
    storageSyncState.lastUploadBytes = stat.size;
    storageSyncState.uploadCount += 1;
    if (res && res.fileID) {
      if (storageSyncState.fileId !== res.fileID) {
        storageSyncState.fileId = res.fileID;
        console.log('[StorageSync] ★ 快照 fileID（请配置到环境变量 DB_SNAPSHOT_FILE_ID）:', res.fileID);
      }
    }
    console.log(`[StorageSync] 快照已上传 ${CLOUD_PATH} (${stat.size} bytes)`);
    return { ok: true, fileID: res?.fileID };
  } catch (e) {
    const msg = (e as Error).message;
    storageSyncState.lastUploadError = msg;
    console.warn('[StorageSync] 快照上传失败:', msg);
    return { ok: false, error: msg };
  } finally {
    try {
      if (fs.existsSync(snapshotPath)) fs.unlinkSync(snapshotPath);
    } catch {
      /* ignore */
    }
  }
}

export async function downloadSnapshot(destPath: string): Promise<{ ok: boolean; error?: string }> {
  if (!isStorageSyncEnabled()) return { ok: false, error: '同步未启用' };
  const fileID = process.env.DB_SNAPSHOT_FILE_ID;
  if (!fileID) return { ok: false, error: '未配置 DB_SNAPSHOT_FILE_ID' };

  const client = getApp();
  if (!client) return { ok: false, error: storageSyncState.initError || 'SDK 未就绪' };

  try {
    const res = await client.downloadFile({ fileID });
    const buf: Buffer = res?.fileContent;
    if (!buf || !buf.length) return { ok: false, error: '云端快照为空' };

    // 原子写入：先落 .download 再 rename，避免半截文件被当作数据库打开
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const tmp = `${destPath}.download`;
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, destPath);

    storageSyncState.lastDownloadAt = new Date().toISOString();
    storageSyncState.lastDownloadError = null;
    console.log(`[StorageSync] 已从对象存储恢复数据库 ${destPath} (${buf.length} bytes)`);
    return { ok: true };
  } catch (e) {
    const msg = (e as Error).message;
    storageSyncState.lastDownloadError = msg;
    console.warn('[StorageSync] 快照下载失败（将使用容器内现有数据库）:', msg);
    return { ok: false, error: msg };
  }
}

// ===== debounce 上传调度 =====
let timer: NodeJS.Timeout | null = null;
let dbGetter: (() => any) | null = null;

async function runUpload(): Promise<void> {
  if (!dbGetter) return;
  try {
    await uploadSnapshot(dbGetter());
  } catch {
    /* 已在 uploadSnapshot 内部记录 */
  }
}

export function scheduleUpload(getDb: () => any, delayMs = UPLOAD_DEBOUNCE_MS): void {
  if (!isStorageSyncEnabled()) return;
  dbGetter = getDb;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void runUpload();
  }, delayMs);
}

/** 进程退出前强制上传一次，避免丢掉最后几秒的改动 */
export async function flushUpload(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (dbGetter && isStorageSyncEnabled()) {
    await runUpload();
  }
}
