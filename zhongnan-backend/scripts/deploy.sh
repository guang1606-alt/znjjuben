#!/usr/bin/env bash
# 生产部署脚本（单机 /opt/zhongnan-backend）
# 用法：./scripts/deploy.sh
# 流程：依赖 -> prisma generate -> 编译 -> 全量测试 -> db push（项目无 migration 历史）-> pm2 零停机 reload
# 任一步失败即中止；编译或回归失败时不执行数据库同步和进程重载。
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== 1/6 安装依赖 =="
if [ "${NODE_ENV:-}" = "production" ] || [ "${CI:-}" = "true" ]; then
  npm ci --omit=dev=false
else
  npm ci
fi

echo "== 2/6 Prisma Client 生成 =="
npx prisma generate

echo "== 3/6 TypeScript 编译 =="
# 测试读取 dist/，必须先编译当前源码，避免验证旧构建产物。
npm run build

echo "== 4/6 全量回归（内存桩，不碰生产库）=="
# 统一入口预设 NODE_ENV=test，避免 .env 的生产配置改变测试运行环境。
npm test

echo "== 5/6 同步数据库结构（db push；含 PostLike 等新表）=="
# 本仓库无 prisma migrate 历史，用 db push 对齐 schema；首次上线前请先 ./scripts/backup-db.sh
npx prisma db push --skip-generate

echo "== 6/6 pm2 启动/零停机重载 =="
if pm2 describe zhongnan-api >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

sleep 2
node scripts/healthcheck.cjs
echo "[deploy] 部署完成且健康检查通过"
