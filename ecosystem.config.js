/**
 * PM2 进程管理配置（ESM 格式，兼容宝塔面板）
 * 宝塔 PM2 管理器可自动识别此文件
 * 命令行启动: pm2 start ecosystem.config.js
 */
export default {
  apps: [
    {
      name: 'schedule-system',
      script: './server-start.cjs',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/error.log',
      out_file: './logs/output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
