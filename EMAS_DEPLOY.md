# 阿里云 EMAS 部署指南

本文档说明如何将行程管理系统部署到阿里云 EMAS (Enterprise Mobile Application Service)。

## 一、EMAS 服务架构

阿里云 EMAS 提供 Serverless 后端服务，支持 Node.js 应用一键部署：

```
┌─────────────────────────────────────────────────────┐
│                    客户端 (Web/App)                 │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              EMAS API Gateway (HTTPS)               │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│           EMAS Serverless Service (Node.js)        │
│  ┌─────────────────────────────────────────────┐   │
│  │              Express App (Port: 80)         │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              阿里云 OSS (持久化存储)                │
│           /mnt/data/dev.db (SQLite 数据库)          │
└─────────────────────────────────────────────────────┘
```

## 二、前置条件

### 1. 开通阿里云 EMAS

1. 访问 [阿里云 EMAS 控制台](https://emas.console.aliyun.com/)
2. 点击 **立即开通**
3. 选择计费模式（按量付费或包年包月）

### 2. 创建应用

1. 进入 EMAS 控制台 → **应用管理** → **创建应用**
2. 填写：
   - 应用名称：`schedule-system`
   - 应用类型：选择 **后端服务**
   - 运行环境：Node.js

### 3. 创建 OSS 存储桶（用于持久化数据）

1. 访问 [OSS 控制台](https://oss.console.aliyun.com/)
2. 点击 **创建 Bucket**
3. 填写：
   - Bucket 名称：`schedule-system-data`（全局唯一）
   - 地域：与 EMAS 应用相同地域（如杭州）
   - 存储类型：标准存储
   - 读写权限：私有

### 4. 获取访问密钥

1. 访问 [RAM 控制台](https://ram.console.aliyun.com/)
2. 创建 RAM 用户，获取 AccessKey ID 和 AccessKey Secret
3. 为用户授予 `AliyunOSSFullAccess` 权限

## 三、部署步骤

### 方式一：通过 EMAS 控制台部署（推荐）

#### 步骤 1：构建镜像

```bash
# 进入项目目录
cd /path/to/1111

# 使用 EMAS Dockerfile 构建镜像
docker build -f Dockerfile.emas -t registry.cn-hangzhou.aliyuncs.com/your-namespace/schedule-system:latest .
```

#### 步骤 2：推送镜像到阿里云容器镜像服务

```bash
# 登录阿里云容器镜像服务
docker login registry.cn-hangzhou.aliyuncs.com

# 推送镜像
docker push registry.cn-hangzhou.aliyuncs.com/your-namespace/schedule-system:latest
```

#### 步骤 3：在 EMAS 控制台部署

1. 进入 EMAS 控制台 → **应用管理** → 选择 `schedule-system`
2. 点击 **部署** → **使用镜像部署**
3. 填写：
   - 镜像地址：`registry.cn-hangzhou.aliyuncs.com/your-namespace/schedule-system:latest`
   - 端口：`80`
   - 内存：`1024` MB
   - CPU：`1` 核

#### 步骤 4：配置持久化存储

1. 在应用详情页 → **存储配置** → **添加存储**
2. 填写：
   - 存储类型：OSS
   - Bucket：`schedule-system-data`
   - 挂载路径：`/mnt/data`
   - 权限：读写

#### 步骤 5：配置环境变量

在应用详情页 → **环境配置** → 添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `NODE_ENV` | `production` | 生产环境标识 |
| `PORT` | `80` | 服务端口 |
| `EMAS_ENV` | `true` | EMAS 环境标识 |
| `OSS_BUCKET` | `schedule-system-data` | OSS 存储桶名称 |
| `OSS_REGION` | `oss-cn-hangzhou` | OSS 地域 |

#### 步骤 6：部署并验证

1. 点击 **立即部署**
2. 等待部署完成（约 2-3 分钟）
3. 通过访问地址验证：`https://xxxxxx.emas.aliyun.com`
4. 测试接口：`https://xxxxxx.emas.aliyun.com/api/health`

### 方式二：通过 EMAS CLI 部署

#### 步骤 1：安装 EMAS CLI

```bash
# 安装阿里云 CLI
npm install -g @alicloud/emas-cli

# 配置访问密钥
emas config set accessKeyId YOUR_ACCESS_KEY_ID
emas config set accessKeySecret YOUR_ACCESS_KEY_SECRET
emas config set regionId cn-hangzhou
```

#### 步骤 2：初始化应用

```bash
# 进入项目目录
cd /path/to/1111

# 初始化 EMAS 应用
emas init
```

#### 步骤 3：部署

```bash
# 直接部署
emas deploy
```

## 四、配置自定义域名

### 1. 在 EMAS 控制台配置

1. 应用详情页 → **域名配置** → **添加域名**
2. 输入自定义域名（如 `api.yourdomain.com`）
3. 按照提示在域名服务商处配置 CNAME 解析

### 2. 配置 SSL 证书

1. 域名配置页 → 点击 **申请证书** 或 **上传证书**
2. 完成 HTTPS 配置

## 五、数据备份

### 定时备份到 OSS

系统已内置定时备份功能，每天凌晨 2:00 将数据库备份到指定邮箱。

如需额外备份到 OSS，可以通过以下方式：

1. 在 OSS 控制台创建生命周期规则
2. 设置自动备份策略

## 六、常见问题

### Q1: 部署后访问返回 502 Bad Gateway

**原因**：应用启动失败，健康检查未通过

**排查**：
1. 检查应用日志，查看错误信息
2. 确认端口配置为 `80`
3. 确认 `server-start-emas.cjs` 是否存在

### Q2: 数据库无法持久化

**原因**：OSS 存储未正确挂载

**解决**：
1. 确认存储桶存在且权限正确
2. 确认挂载路径为 `/mnt/data`
3. 重启应用

### Q3: 跨域问题

**解决**：在 EMAS 控制台 → **网络配置** → **开启 CORS**，允许所有来源或指定域名。

### Q4: 内存不足

**解决**：在应用配置中将内存调整为 `2048` MB 或更高。

## 七、目录结构

```
1111/
├── Dockerfile.emas          # EMAS 专用 Dockerfile
├── server-start-emas.cjs    # EMAS 环境启动器
├── emas.json                # EMAS 应用配置
├── api/
│   ├── db/index.ts          # 数据库配置（已适配 EMAS）
│   └── ...
├── src/
│   └── ...
└── ...
```

## 八、与 CloudBase 对比

| 功能 | 腾讯云 CloudBase | 阿里云 EMAS |
|------|-----------------|-------------|
| 计算服务 | 云托管（K8s） | Serverless |
| 数据库 | SQLite + COS | SQLite + OSS |
| 免费额度 | 有 | 有 |
| 镜像仓库 | CCR | ACR |
| 域名绑定 | 支持 | 支持 |
| 日志查看 | 控制台 | 控制台 |
| 适用场景 | 快速开发 | 阿里云生态 |

## 九、切换建议

如果您已经在使用 CloudBase，切换到 EMAS 需要：

1. **重新部署**：两套平台完全独立
2. **数据迁移**：导出 CloudBase 数据库，导入 EMAS
3. **域名更新**：重新配置域名解析
4. **配置迁移**：重新设置环境变量和存储

推荐方案：选择其中一个平台，不要同时使用两个。
