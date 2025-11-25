# AAVE USDC 监控程序

## 功能概述

实时监控 AAVE V3 USDC 借贷池的关键数据：
- **Reserve Size (总流动性)**
- **Available Liquidity (可用流动性)**  
- **Utilization Rate (资金利用率)**

当利用率超过 90% 或 95% 时会自动输出告警信息。

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置 RPC
编辑 `.env` 文件，设置 Ethereum RPC URL：
```bash
RPC_URL=https://rpc.ankr.com/eth  # 或使用您的 Infura/Alchemy URL
```

### 3. 运行监控
```bash
npm start
# 或
node aave.js
```

程序会：
- 立即执行一次数据获取
- 每 10 分钟自动刷新一次数据
- 当利用率 > 90% 时输出 `[WARNING]`
- 当利用率 > 95% 时输出 `[CRITICAL ALERT]`

### 4. 停止监控
按 `Ctrl+C` 停止程序

## 技术实现

### 核心方案
直接查询 AAVE V3 Pool 合约和 ERC20 代币合约：

1. **Pool 合约** (`0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`)
   - 调用 `getReserveData(USDC)` 获取储备数据
   - 获取 aToken、债务代币的合约地址

2. **ERC20 代币查询**
   - `aToken.totalSupply()` - 获取总流动性
   - `variableDebtToken.totalSupply()` - 获取可变利率债务
   - `stableDebtToken.totalSupply()` - 获取固定利率债务
   - `USDC.balanceOf(aToken)` - 获取可用流动性

3. **计算逻辑**
   ```javascript
   Total Debt = Variable Debt + Stable Debt
   Total Liquidity = aToken Supply
   Available Liquidity = USDC balance of aToken
   Utilization Rate = Total Debt / Total Liquidity
   ```

## 示例输出

```
--- AAVE V3 USDC Monitor ---
Total Liquidity (Reserve Size): 5,058,236,783.803 USDC
Available Liquidity:            805,019,769.336 USDC
Total Debt:                     4,253,410,838.795 USDC
Utilization Rate:               84.09%

Status: Normal (Utilization < 90%)
```

## Telegram 通知（可选）

程序支持通过 Telegram 发送告警通知。

### 配置步骤

1. **创建 Telegram Bot**
   - 在 Telegram 中找到 @BotFather
   - 发送 `/newbot` 创建 bot
   - 获取 Bot Token

2. **获取 Chat ID**
   - 向 bot 发送消息
   - 访问 `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - 找到 `chat.id`

3. **配置 .env**
   ```bash
   TELEGRAM_BOT_TOKEN="your_bot_token"
   TELEGRAM_CHAT_ID="your_chat_id"
   ```

详细设置说明请参考 [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md)

### 通知内容

当利用率超过阈值时，会收到包含以下信息的 Telegram 消息：
- 告警级别（WARNING / CRITICAL）
- 当前利用率
- 总流动性、可用流动性、总债务
- 时间戳

## 后续优化建议

1. **数据持久化**: 将监控数据保存到数据库
2. **告警通知**: 集成 Telegram/Discord/邮件通知
3. **图表展示**: 添加 Web 界面显示历史趋势
4. **多币种支持**: 扩展监控其他资产（DAI、USDT 等）
5. **错误重试**: 添加 RPC 调用失败的重试机制