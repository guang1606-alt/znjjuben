#!/usr/bin/env bash
# PostgreSQL 逻辑备份（终南集生产）
# 用法：
#   ./scripts/backup-db.sh                # 立即备份，保留 14 天
#   KEEP_DAYS=30 ./scripts/backup-db.sh
# crontab（每天 03:17，日志见 logs/backup.log）：
#   17 3 * * * cd /opt/zhongnan-backend && ./scripts/backup-db.sh >> logs/backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "[backup] 缺少 .env（DATABASE_URL 未配置）" >&2
  exit 2
fi
set -a
# shellcheck disable=SC1091
. ./.env
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[backup] .env 中未找到 DATABASE_URL" >&2
  exit 2
fi
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "[backup] 未找到 pg_dump（Ubuntu: sudo apt install postgresql-client-16）" >&2
  exit 2
fi

KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p backups logs
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="backups/zhongnan-${STAMP}.sql.gz"

echo "[backup] 开始备份 -> $OUT"
# --no-owner/--no-acl：方便跨账号恢复；-Fc 本脚本用纯 SQL+gzip，zcat | psql 即可恢复
pg_dump --no-owner --no-acl --dbname="$DATABASE_URL" | gzip -9 > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
SIZE="$(du -h "$OUT" | cut -f1)"
echo "[backup] 完成 $OUT ($SIZE)"

echo "[backup] 清理 ${KEEP_DAYS} 天前的备份"
find backups -maxdepth 1 -name 'zhongnan-*.sql.gz' -type f -mtime "+${KEEP_DAYS}" -print -delete

# 恢复方法（确认后手工执行）：
#   gunzip -c backups/zhongnan-YYYYmmdd-HHMMSS.sql.gz | psql "$DATABASE_URL"
