# Telegram 通知设置指南

## 步骤 1: 创建 Telegram Bot

1. 在 Telegram 中搜索 `@BotFather`
2. 发送命令 `/newbot`
3. 按照提示设置 bot 名称和用户名
4. 保存 BotFather 返回的 **Bot Token**（格式类似：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）

## 步骤 2: 获取 Chat ID

### 发送到个人聊天

#### 方法 1: 使用 userinfobot
1. 在 Telegram 中搜索 `@userinfobot`
2. 点击 Start
3. Bot 会返回您的 Chat ID

#### 方法 2: 通过 API 获取
1. 向您刚创建的 bot 发送任意消息
2. 在浏览器中访问：
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
   （将 `<YOUR_BOT_TOKEN>` 替换为您的实际 token）
3. 在返回的 JSON 中找到 `"chat":{"id":123456789}` 中的数字

### 发送到群聊 🆕

1. **创建群聊或使用现有群聊**

2. **将 bot 添加到群聊**
   - 在群聊中点击群组名称
   - 选择"添加成员"
   - 搜索并添加您的 bot

3. **获取群聊 Chat ID**
   
   **方法 1: 使用 @RawDataBot（推荐）**
   - 将 `@RawDataBot` 添加到群聊
   - Bot 会自动发送群聊信息，包含 Chat ID
   - 记下 `"chat":{"id":-1001234567890}` 中的数字（注意负号）
   - 可以移除 @RawDataBot

   **方法 2: 通过 API 获取**
   - 在群聊中发送任意消息（提及您的 bot，如 `@your_bot_name hello`）
   - 访问：
     ```
     https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
     ```
   - 在返回的 JSON 中找到 `"chat":{"id":-1001234567890,"type":"supergroup"}` 
   - 群聊 ID 通常是负数，以 `-100` 开头

4. **配置 .env**
   ```bash
   TELEGRAM_CHAT_ID="-1001234567890"  # 注意：群聊 ID 是负数
   ```

> [!IMPORTANT]
> - 群聊 Chat ID 通常是负数（如 `-1001234567890`）
> - 个人聊天 Chat ID 是正数（如 `123456789`）
> - 确保 bot 有发送消息的权限

## 步骤 3: 配置环境变量

编辑 `.env` 文件，填入您的凭据：

```bash
TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
TELEGRAM_CHAT_ID="123456789"
```

## 步骤 4: 测试

运行程序：
```bash
npm start
```

您应该看到：
```
Telegram notifications enabled
```

## 通知示例

当利用率超过阈值时，您会收到类似这样的消息：

```
⚠️ AAVE USDC WARNING ALERT

⏰ Time: 2025-11-25 10:15:30
📊 Utilization Rate: 92.50%

💰 Total Liquidity: 5,000,000,000 USDC
✅ Available: 375,000,000 USDC
📈 Total Debt: 4,625,000,000 USDC
```

## 故障排除

### 问题：收不到通知
- 确认 Bot Token 和 Chat ID 正确
- 确认已向 bot 发送过至少一条消息
- 检查控制台是否有错误信息

### 问题：程序无法启动
- 如果没有配置 Telegram 凭据，程序仍会正常运行，只是不会发送通知
- 检查 `.env` 文件格式是否正确（无多余空格、引号）
