require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// Load configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Validate configuration
if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ Error: Missing Telegram configuration!');
    console.error('Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env file');
    process.exit(1);
}

console.log('📱 Telegram Bot Test');
console.log('===================');
console.log(`Bot Token: ${TELEGRAM_BOT_TOKEN.substring(0, 10)}...`);
console.log(`Chat ID: ${TELEGRAM_CHAT_ID}`);
console.log('');

// Initialize bot
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

// Test message
const testMessage = `🧪 *测试消息*

这是一条来自 AAVE 监控程序的测试消息。

⏰ 时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
✅ Bot 配置正确
📊 准备接收告警通知

如果您看到这条消息，说明配置成功！`;

// Send test message
console.log('📤 Sending test message...');
bot.sendMessage(TELEGRAM_CHAT_ID, testMessage, { parse_mode: 'Markdown' })
    .then(() => {
        console.log('✅ Test message sent successfully!');
        console.log('');
        console.log('Please check your Telegram group/chat.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Failed to send message:');
        console.error(error.message);
        console.log('');
        console.log('Common issues:');
        console.log('1. Bot Token is incorrect');
        console.log('2. Chat ID is incorrect');
        console.log('3. Bot is not added to the group');
        console.log('4. Bot does not have permission to send messages');
        process.exit(1);
    });
