/**
 * CloudBase 云托管启动入口
 * 设置 CLOUDBASE_ENV=true 以启用持久化存储路径
 */
process.env.CLOUDBASE_ENV = 'true';
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '80';

require('tsx/cjs');
require('./api/server.ts');
