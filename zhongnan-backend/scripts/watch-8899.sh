#!/bin/bash
# 终南集 8899 守护进程：死了自动重启
cd "$(dirname "$0")/.."
LOG=/tmp/zn8899.out.log
ERR=/tmp/zn8899.err.log

cleanup() { echo "$(date) 守护退出" >> $LOG; exit 0; }
trap cleanup SIGTERM SIGINT

echo "$(date) 守护启动" >> $LOG
while true; do
  PID=$(lsof -ti:8899 2>/dev/null)
  if [ -z "$PID" ]; then
    echo "$(date) 8899 挂了，重启..." >> $LOG
    nohup node dist/index.js >> $LOG 2>> $ERR &
    sleep 3
  else
    sleep 10
  fi
done
