/**
 * 阿里云 EMAS 环境启动器
 * 适配 EMAS Serverless 部署环境
 */
const { exec } = require('child_process');
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

// 确保 tsx 可用
const tsxPath = require.resolve('tsx/cli');
console.log('[EMAS] tsx 路径:', tsxPath);

// 启动主服务
const serverPath = path.join(__dirname, 'api/server.ts');
console.log(`[EMAS] 启动服务: ${serverPath}`);
console.log(`[EMAS] 端口: ${port}`);

const child = exec(`node -r tsx ${serverPath}`, {
  env: {
    ...process.env,
    PORT: String(port),
    EMAS_ENV: isEmas ? 'true' : 'false'
  }
});

child.stdout?.pipe(process.stdout);
child.stderr?.pipe(process.stderr);

child.on('close', (code) => {
  console.log(`[EMAS] 服务退出，代码: ${code}`);
  process.exit(code || 0);
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