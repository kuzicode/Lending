#!/bin/bash

pm2 delete aave-monitor  2>/dev/null
pm2 delete morpho-monitor 2>/dev/null
pm2 save

echo "[INFO] 所有监控已停止"
pm2 list
