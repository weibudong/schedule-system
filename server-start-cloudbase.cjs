/**
 * CloudBase 云托管启动入口
 * 设置 CLOUDBASE_ENV=true 以启用持久化存储路径
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// 设置环境变量
process.env.CLOUDBASE_ENV = 'true';
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '80';

const port = process.env.PORT;

console.log('[CloudBase] 启动配置：', {
  port,
  cloudbaseEnv: process.env.CLOUDBASE_ENV,
  nodeEnv: process.env.NODE_ENV
});

// 确保持久化目录存在
try {
  fs.mkdirSync('/mnt/data', { recursive: true });
  console.log('[CloudBase] 持久化目录已创建: /mnt/data');
} catch (err) {
  console.log('[CloudBase] 无法创建 /mnt/data（可能是本地环境），跳过');
}

// 使用 tsx 运行 TypeScript 服务
const serverPath = path.join(__dirname, 'api/server.ts');
console.log(`[CloudBase] 启动服务: ${serverPath}`);

const child = exec(`node -r tsx ${serverPath}`, {
  env: {
    ...process.env,
    PORT: String(port)
  }
});

child.stdout?.pipe(process.stdout);
child.stderr?.pipe(process.stderr);

child.on('close', (code) => {
  console.log(`[CloudBase] 服务退出，代码: ${code}`);
  process.exit(code || 0);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('[CloudBase] 收到终止信号，正在关闭服务...');
  child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('[CloudBase] 收到中断信号，正在关闭服务...');
  child.kill('SIGINT');
});
