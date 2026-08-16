/**
 * CloudBase 云托管启动入口
 * 使用 tsx CLI 方式启动，避免 Node.js 22 ESM 兼容性问题
 */
const { spawn } = require('child_process');
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
  nodeEnv: process.env.NODE_ENV,
  nodeVersion: process.version
});

// 确保持久化目录存在
try {
  fs.mkdirSync('/mnt/data', { recursive: true });
  console.log('[CloudBase] 持久化目录已创建: /mnt/data');
} catch (err) {
  console.log('[CloudBase] 无法创建 /mnt/data（可能是本地环境），跳过');
}

// 查找 tsx 路径
const tsxBinPath = path.join(__dirname, 'node_modules', '.bin', 'tsx');
const serverPath = path.join(__dirname, 'api', 'server.ts');

console.log(`[CloudBase] tsx 路径: ${tsxBinPath}`);
console.log(`[CloudBase] 启动服务: ${serverPath}`);

// 检查 tsx 是否存在
if (!fs.existsSync(tsxBinPath)) {
  console.error('[CloudBase] tsx 未安装，正在尝试查找其他路径...');
  const altPath = path.join(__dirname, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  if (fs.existsSync(altPath)) {
    console.log(`[CloudBase] 找到 tsx CLI: ${altPath}`);
  } else {
    console.error('[CloudBase] 错误: 找不到 tsx，请先运行 npm install');
    process.exit(1);
  }
}

// 使用 tsx 启动 TypeScript 服务（spawn 更可靠）
const child = spawn(tsxBinPath, [serverPath], {
  env: {
    ...process.env,
    PORT: String(port)
  },
  stdio: 'inherit'
});

child.on('close', (code) => {
  console.log(`[CloudBase] 服务退出，代码: ${code}`);
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('[CloudBase] 启动失败:', err.message);
  process.exit(1);
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
