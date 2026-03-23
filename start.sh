#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"

if ! command -v pm2 &>/dev/null; then
  echo "[ERROR] pm2 未安装，请先执行: npm install -g pm2"
  exit 1
fi

mkdir -p "$LOG_DIR"

echo "[INFO] 项目目录: $SCRIPT_DIR"
echo "[INFO] 日志目录: $LOG_DIR"
echo ""

# 停止已有同名进程（幂等重启）
pm2 delete aave-monitor  2>/dev/null
pm2 delete morpho-monitor 2>/dev/null

# 启动 aave.js（当前已注释）
# pm2 start "$SCRIPT_DIR/aave.js" \
#   --name "aave-monitor" \
#   --output "$LOG_DIR/aave-out.log" \
#   --error  "$LOG_DIR/aave-err.log" \
#   --log-date-format "YYYY-MM-DD HH:mm:ss" \
#   --restart-delay 5000

# 启动 morpho.js
pm2 start "$SCRIPT_DIR/morpho.js" \
  --name "morpho-monitor" \
  --output "$LOG_DIR/morpho-out.log" \
  --error  "$LOG_DIR/morpho-err.log" \
  --log-date-format "YYYY-MM-DD HH:mm:ss" \
  --restart-delay 5000

pm2 save

echo ""
echo "[INFO] 启动完成："
pm2 list
