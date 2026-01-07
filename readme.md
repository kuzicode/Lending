# Lending Monitor Suite

监控 DeFi 借贷池利用率，当利用率超阈值时推送 Telegram 告警。

**监控池子（共 3 个）：**
- **AAVE V3 USDC** (Ethereum) - `aave.js`
- **Gauntlet USDC Prime** (Base/Morpho) - `morpho.js`
- **Steakhouse Prime USDC** (Base/Morpho) - `morpho.js`

## 快速开始

1. **安装依赖**
   ```bash
   npm install
   ```

2. **配置 `.env`**
   ```bash
   # Telegram (可选)
   TELEGRAM_BOT_TOKEN="xxx"
   TELEGRAM_CHAT_ID="xxx"

   # AAVE (Ethereum)
   RPC_URL="https://rpc.ankr.com/eth"
   ```

3. **运行脚本**
   ```bash
   node aave.js    # AAVE V3 USDC
   node morpho.js  # Morpho Vaults (2个)
   ```

4. **停止** `Ctrl+C`

## 监控内容

| 池子 | 链 | 地址 | WARNING | CRITICAL |
| --- | --- | --- | --- | --- |
| AAVE V3 USDC | Ethereum | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` | > 90% | > 95% |
| Gauntlet USDC Prime | Base | `0xeE8F4eC5672F09119b96Ab6fB59C27E1b7e44b61` | > 90% | > 95% |
| Steakhouse Prime USDC | Base | `0xBEEFE94c8aD530842bfE7d8B397938fFc1cb83b2` | > 90% | > 95% |

**关键指标：** Total Liquidity、Available Liquidity、Utilization Rate、Supply APY

## 定时任务

- **每 10 分钟**：刷新数据，超阈值时推送告警
- **每天 9:00（北京时间）**：推送日报（无论是否超阈值）

## 示例输出

```
--- AAVE V3 USDC Monitor ---
Total Liquidity:   4,810,000,000 USDC
Available:           882,140,000 USDC
Utilization Rate:  81.65%
Supply APY:        3.99%
Status: Normal

--- Morpho: Gauntlet USDC Prime (Base) ---
Total Deposits:    150,000,000 USDC
Available:          45,000,000 USDC
Utilization Rate:  70.00%
Supply APY:        5.20%
Status: Normal

--- Morpho: Steakhouse Prime USDC (Base) ---
Total Deposits:    200,000,000 USDC
Available:          60,000,000 USDC
Utilization Rate:  70.00%
Supply APY:        4.80%
Status: Normal
```

## Telegram 设置

详见 [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md)
