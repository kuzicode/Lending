# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

DeFi lending pool utilization monitor that polls on-chain/API data and sends Telegram alerts when utilization exceeds thresholds (>90% WARNING, >95% CRITICAL). Also sends a daily report at 9:00 AM Asia/Shanghai.

**Monitored pools:**
- **AAVE V3 USDC** (Ethereum) — `aave.js` — reads on-chain via ethers.js + RPC
- **Gauntlet USDC Prime** + **Steakhouse Prime USDC** (Base/Morpho) — `morpho.js` — reads from Morpho GraphQL API

## Commands

```bash
npm install              # install dependencies
node aave.js             # run AAVE monitor standalone
node morpho.js           # run Morpho monitor standalone
bash start.sh            # start monitors via pm2 (requires pm2 globally installed)
bash stop.sh             # stop all monitors
```

pm2 management:
```bash
pm2 logs morpho-monitor  # tail logs
pm2 list                 # status
pm2 restart all          # restart
```

## Architecture

Each monitor script (`aave.js`, `morpho.js`) is self-contained and follows the same pattern:
1. Fetch pool data (on-chain RPC for AAVE, GraphQL API for Morpho)
2. Compute utilization rate and supply APY
3. Log to console; send Telegram alert if utilization > threshold (1-hour cooldown between alerts)
4. Run on a 10-minute `setInterval` loop, plus a 1-minute interval that triggers a daily report at 09:00 Shanghai time

**Key differences between the two monitors:**
- `aave.js` uses `ethers.JsonRpcProvider` to call AAVE V3 Pool contract directly (requires `RPC_URL` env var for Ethereum mainnet)
- `morpho.js` uses `fetch()` against `https://api.morpho.org/graphql` (no RPC needed); monitors two vaults in a single process

## Environment Variables (`.env`)

- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — Telegram alerting (optional; monitors run without them)
- `TELEGRAM_TOPIC_ID` — 群组话题 ID（可选；设置后消息发送到指定话题而非群组主频道）
- `RPC_URL` — Ethereum RPC endpoint (required by `aave.js` only)

## Alert Thresholds

| Level | Utilization | Cooldown |
|-------|------------|----------|
| WARNING | > 90% | 1 hour |
| CRITICAL | > 95% | 1 hour |
