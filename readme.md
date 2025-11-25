# Lending Monitor Suite

两套脚本，统一 README：
- `aave.js`：监控 Ethereum 上的 AAVE V3 USDC 资金池
- `morpho.js`：监控 Base 链上 Morpho Spark USDC Vault

两者都会每 10 分钟刷新一次数据，并在利用率超过阈值时给出控制台与 Telegram 告警。

## 快速开始

1. **安装依赖**
   ```bash
   npm install
   ```
2. **配置 `.env`**
   ```bash
   # 通用
   TELEGRAM_BOT_TOKEN="xxx"   # 可选
   TELEGRAM_CHAT_ID="xxx"     # 可选

   # AAVE
   RPC_URL="https://rpc.ankr.com/eth"

   # Morpho
   BASE_RPC_URL="https://mainnet.base.org"
   ```
   如需 Telegram 机器人，可参照 [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md)。
3. **运行脚本**
   ```bash
   # AAVE
   node aave.js

   # Morpho
   node morpho.js
   ```
4. **停止**
   `Ctrl+C`

## 监控内容

| 脚本 | 数据源 | 关键指标 | WARNING | CRITICAL |
| --- | --- | --- | --- | --- |
| `aave.js` | AAVE V3 Pool 合约 `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` + USDC/ERC20 代币 | 总流动性、可用流动性、总债务、Utilization | > 90% | > 95% |
| `morpho.js` | Morpho GraphQL API `https://api.morpho.org/graphql` + Vault `0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A` | Total Assets、Available Liquidity、Deployed Assets、Utilization | > 90% | > 95% |

## 计算逻辑摘要

```javascript
// AAVE
totalLiquidity   = aToken.totalSupply()
totalDebt        = variableDebt.totalSupply() + stableDebt.totalSupply()
available        = usdc.balanceOf(aToken)
utilization      = totalDebt / totalLiquidity

// Morpho
totalAssets      = vault.totalAssets()
available        = Σ min(marketSupply - marketBorrow, vaultSupplyInMarket)
deployed         = totalAssets - available
utilization      = deployed / totalAssets
```

两个脚本都会立即拉取一次最新状态，然后按 10 分钟间隔刷新。如果命中阈值，控制台输出 `[WARNING]` 或 `[CRITICAL]`，并推送 Telegram（如配置）。

## 示例输出

```
--- AAVE V3 USDC Monitor ---
Total Liquidity:   5,058,236,783.803 USDC
Available:           805,019,769.336 USDC
Utilization:        84.09%
Status: Normal (Utilization < 90%)

--- Morpho Vault Monitor (Base) ---
Vault: Spark USDC Vault
Total Assets:      308,738,080.524 USDC
Available:         102,387,794.389 USDC
Utilization:       66.84%
Status: Normal (Utilization < 90%)
```

## 后续可优化
- 数据持久化与可视化
- 多资产/多协议扩展
- 告警渠道（Discord / 邮件）与重试机制