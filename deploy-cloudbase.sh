#!/bin/bash
# CloudBase 部署包打包脚本

set -e

# 配置
PROJECT_ROOT="/Users/wk/Desktop/1111"
DEPLOY_DIR="$PROJECT_ROOT/deploy-cloudbase"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "=========================================="
echo "CloudBase 部署包打包脚本"
echo "=========================================="

# 1. 清理旧的部署目录
echo "[1/6] 清理旧的部署目录..."
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

# 2. 复制核心文件
echo "[2/6] 复制项目文件..."

# 复制配置文件
cp "$PROJECT_ROOT/package.json" "$DEPLOY_DIR/"
cp "$PROJECT_ROOT/package-lock.json" "$DEPLOY_DIR/"
cp "$PROJECT_ROOT/server-start-cloudbase.cjs" "$DEPLOY_DIR/"
cp "$PROJECT_ROOT/Dockerfile" "$DEPLOY_DIR/"

# 创建必要目录
mkdir -p "$DEPLOY_DIR/api"
mkdir -p "$DEPLOY_DIR/data"
mkdir -p "$DEPLOY_DIR/backup"

# 复制后端代码（保持 api 目录结构）
cp -r "$PROJECT_ROOT/api" "$DEPLOY_DIR/"

# 复制前端构建产物
if [ -d "$PROJECT_ROOT/dist" ]; then
    cp -r "$PROJECT_ROOT/dist" "$DEPLOY_DIR/"
    echo "  ✓ dist/ (前端构建产物)"
else
    echo "  ✗ dist/ 不存在，请先运行 npm run build"
    exit 1
fi

# 复制 public 目录
if [ -d "$PROJECT_ROOT/public" ]; then
    cp -r "$PROJECT_ROOT/public" "$DEPLOY_DIR/"
    echo "  ✓ public/"
fi

# 3. 清理不需要的文件
echo "[3/6] 清理不需要的文件..."

# 删除 node_modules
rm -rf "$DEPLOY_DIR/api/node_modules" 2>/dev/null || true

# 删除 data 目录中的旧备份文件
find "$DEPLOY_DIR/data" -name "*.json" -type f -delete 2>/dev/null || true
find "$DEPLOY_DIR/api/data" -name "*.json" -type f -delete 2>/dev/null || true

# 删除 backup 目录中的旧备份文件
find "$DEPLOY_DIR/backup" -name "*.db" -type f -delete 2>/dev/null || true
find "$DEPLOY_DIR/api/backup" -name "*.db" -type f -delete 2>/dev/null || true

# 删除 .env 文件
rm -f "$DEPLOY_DIR/.env" 2>/dev/null || true
rm -f "$DEPLOY_DIR/api/.env" 2>/dev/null || true
rm -f "$DEPLOY_DIR/api/.env.local" 2>/dev/null || true

# 删除 git 相关文件
rm -rf "$DEPLOY_DIR/.git" 2>/dev/null || true
rm -f "$DEPLOY_DIR/.gitignore" 2>/dev/null || true

# 删除其他不需要的文件
rm -f "$DEPLOY_DIR/api/dev.db" 2>/dev/null || true  # 只保留 api/db/dev.db

# 4. 创建 README
echo "[4/6] 创建部署说明..."
cat > "$DEPLOY_DIR/README-CLOUDBASE.md" << 'EOF'
# CloudBase 部署说明

## 环境变量配置

在 CloudBase 控制台 → 环境配置 → 变量配置中添加：

### 邮件备份配置（可选）
```
MAIL_USER=your-email@qq.com
MAIL_PASS=your-qq-authorization-code
MAIL_FROM=your-email@qq.com
MAIL_TO=your-email@qq.com
```

### 其他配置
```
NODE_ENV=production
CLOUDBASE_ENV=true
```

## 部署步骤

1. 将此目录上传到 CloudBase 云托管
2. 在 CloudBase 控制台配置环境变量
3. 启动服务（端口：80）

## 数据库说明

- 数据库文件路径：`api/dev.db`
- 生产环境数据存储在容器内，重启后会丢失
- 建议开启持久化存储或使用邮件备份功能
EOF

# 5. 生成多种格式的压缩包
echo "[5/6] 生成部署包..."

# 生成 TAR.GZ 格式（CloudBase 支持）
OUTPUT_TGZ="$PROJECT_ROOT/deploy-${TIMESTAMP}.tgz"
tar -czf "$OUTPUT_TGZ" -C "$DEPLOY_DIR" .
echo "  ✓ $OUTPUT_TGZ"

# 生成 ZIP 格式（备选方案）
OUTPUT_ZIP="$PROJECT_ROOT/deploy-${TIMESTAMP}.zip"
cd "$DEPLOY_DIR" && zip -r -q "$OUTPUT_ZIP" . && cd "$PROJECT_ROOT"
echo "  ✓ $OUTPUT_ZIP"

# 清理临时部署目录
rm -rf "$DEPLOY_DIR"

# 6. 显示结果
echo "[6/6] 打包完成！"
echo ""
echo "=========================================="
echo "生成的部署包："
echo "=========================================="
ls -lh "$OUTPUT_TGZ" "$OUTPUT_ZIP"
echo ""
echo "使用说明："
echo "  1. CloudBase 控制台上传：选择 deploy-${TIMESTAMP}.tgz"
echo "  2. 如果 tgz 无法选择，尝试 deploy-${TIMESTAMP}.zip"
echo "=========================================="