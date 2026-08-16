/**
 * 阿里云 EMAS 环境启动器
 * 使用 tsx CLI 方式启动，避免 Node.js 22 ESM 兼容性问题
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 80;
const isEmas = process.env.EMAS_ENV === 'true';

if (isEmas) {
  console.log('[EMAS] 检测到阿里云 EMAS 环境');
  console.log('[EMAS] 配置信息：', {
    port,
    ossBucket: process.env.OSS_BUCKET,
    ossRegion: process.env.OSS_REGION,
    persistencePath: '/mnt/data'
  });

  // 确保持久化目录存在
  fs.mkdirSync('/mnt/data', { recursive: true });

  // 检查持久化存储是否可用
  const dbPath = '/mnt/data/dev.db';
  if (fs.existsSync(dbPath)) {
    console.log('[EMAS] 数据库已存在:', dbPath);
  } else {
    console.log('[EMAS] 数据库不存在，将自动创建:', dbPath);
  }
}

// 查找 tsx 路径
const tsxBinPath = path.join(__dirname, 'node_modules', '.bin', 'tsx');
const serverPath = path.join(__dirname, 'api', 'server.ts');

console.log(`[EMAS] tsx 路径: ${tsxBinPath}`);
console.log(`[EMAS] 启动服务: ${serverPath}`);
console.log(`[EMAS] 端口: ${port}`);

// 检查 tsx 是否存在
if (!fs.existsSync(tsxBinPath)) {
  console.error('[EMAS] tsx 未安装，请先运行 npm install');
  process.exit(1);
}

// 使用 tsx 启动 TypeScript 服务
const child = spawn(tsxBinPath, [serverPath], {
  env: {
    ...process.env,
    PORT: String(port),
    EMAS_ENV: isEmas ? 'true' : 'false'
  },
  stdio: 'inherit'
});

child.on('close', (code) => {
  console.log(`[EMAS] 服务退出，代码: ${code}`);
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('[EMAS] 启动失败:', err.message);
  process.exit(1);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('[EMAS] 收到终止信号，正在关闭服务...');
  child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('[EMAS] 收到中断信号，正在关闭服务...');
  child.kill('SIGINT');
});
