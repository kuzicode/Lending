#!/bin/bash

# ── 配置区 ───────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"   # 脚本所在目录（自动定位）
LOG_DIR="$HOME/Lending/logs"                  # 日志输出目录
# ─────────────────────────────────────────────────────────

# 检查 pm2 是否安装
if ! command -v pm2 &>/dev/null; then
  echo "[ERROR] pm2 未安装，请先执行: npm install -g pm2"
  exit 1
fi

# 创建日志目录
mkdir -p "$LOG_DIR"

echo "[INFO] 项目目录: $SCRIPT_DIR"
echo "[INFO] 日志目录: $LOG_DIR"
echo ""

# 停止并删除已有同名进程（幂等重启）
pm2 delete aave-monitor  2>/dev/null
pm2 delete morpho-monitor 2>/dev/null

# 启动 aave.js
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

# 保存进程列表（用于开机自启）
pm2 save

echo ""
echo "[INFO] 启动完成，当前进程状态："
pm2 list

echo ""
echo "[INFO] 常用命令："
echo "  实时日志:  pm2 logs aave-monitor"
echo "             pm2 logs morpho-monitor"
echo "  状态查看:  pm2 list"
echo "  停止全部:  pm2 stop all"
echo "  重启全部:  pm2 restart all"
echo "  开机自启:  pm2 startup  (按提示执行 sudo 命令后再次运行 pm2 save)"
