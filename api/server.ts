/**
 * 服务启动入口
 *
 * 启动顺序很关键：
 *   1. 先从对象存储下载数据库快照，覆盖本地 db 文件
 *   2. 再加载 app（app 内部 initDb 会打开数据库）
 * 顺序反了的话，已打开的 SQLite 连接会指向被替换掉的旧 inode，读到的还是旧数据。
 */
import { dbPath, getDb } from './db/index.js';
import { startBackupCron } from './services/backup.js';
import {
  isStorageSyncEnabled,
  downloadSnapshot,
  uploadSnapshot,
  flushUpload,
  storageSyncState
} from './services/storageSync.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

// 1) 恢复云端快照
if (isStorageSyncEnabled()) {
  const r = await downloadSnapshot(dbPath);
  console.log(`[Boot] 云端快照恢复: ${r.ok ? '成功' : `跳过 (${r.error})`}`);
} else {
  console.log('[Boot] 对象存储同步未启用（本地开发默认关闭）');
}

// 2) 快照就位后再加载应用并打开数据库
const { default: app } = await import('./app.js');

let snapshotTimer: NodeJS.Timeout | null = null;

function startSnapshotSchedule() {
  if (!isStorageSyncEnabled()) return;
  const intervalMs = Number(process.env.DB_SNAPSHOT_INTERVAL_MS || 5 * 60 * 1000);
  snapshotTimer = setInterval(() => {
    void uploadSnapshot(getDb());
  }, intervalMs);
  snapshotTimer.unref?.();
  console.log(`[Boot] 对象存储快照定时同步已启动，间隔 ${intervalMs}ms`);
}

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  startBackupCron();
  startSnapshotSchedule();
  console.log(
    `[Boot] 存储同步: enabled=${storageSyncState.enabled} sdkReady=${storageSyncState.sdkReady} fileId=${storageSyncState.fileId || '(未配置)'}`
  );
});

/**
 * 优雅关闭：退出前强制上传一次快照，避免丢掉最后几秒的改动
 */
async function shutdown(signal: string) {
  console.log(`${signal} signal received`);
  if (snapshotTimer) clearInterval(snapshotTimer);
  try {
    await flushUpload();
  } catch (e) {
    console.warn('[Shutdown] 退出前快照上传失败:', (e as Error).message);
  }
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

/**
 * close server
 */
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

export default app;
