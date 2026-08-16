FROM node:22-alpine

# 安装编译依赖和时区
RUN apk add --no-cache python3 make g++ tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo Asia/Shanghai > /etc/timezone

WORKDIR /app

# 先复制依赖配置文件
COPY package*.json ./

# 使用腾讯云 npm 镜像源加速，安装所有依赖
RUN npm config set registry https://mirrors.cloud.tencent.com/npm/ && \
    npm install && \
    npm cache clean --force

# 复制源代码（前端已构建好的 dist 目录和后端代码）
COPY . .

# 创建持久化目录和必要目录
RUN mkdir -p /mnt/data && chmod 777 /mnt/data && \
    mkdir -p /app/api/data && \
    mkdir -p /app/api/backup

# 暴露端口
EXPOSE 80

# 健康检查 - CloudBase 使用 HTTP GET /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:80/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))"

# CloudBase 启动命令
CMD ["node", "server-start-cloudbase.cjs"]