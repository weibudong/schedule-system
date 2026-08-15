/**
 * 生产环境启动入口（CommonJS）
 * 通过 tsx 的 CJS loader 加载 TypeScript 源码，PM2 / 宝塔可直接运行此文件
 * 用法: node server-start.cjs  或  pm2 start server-start.cjs
 */
require('tsx/cjs');
require('./api/server.ts');
