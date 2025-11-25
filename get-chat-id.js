require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ Error: TELEGRAM_BOT_TOKEN not set in .env file');
    process.exit(1);
}

console.log('🔍 Fetching recent updates from Telegram...\n');

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

bot.getUpdates()
    .then((updates) => {
        if (updates.length === 0) {
            console.log('⚠️  No recent messages found.');
            console.log('');
            console.log('请在群组中发送一条消息（可以 @ 您的 bot），然后重新运行此脚本。');
            console.log('例如：@your_bot_name hello');
            process.exit(0);
        }

        console.log(`Found ${updates.length} recent update(s):\n`);

        const chats = new Map();

        updates.forEach((update, index) => {
            if (update.message && update.message.chat) {
                const chat = update.message.chat;
                const chatKey = chat.id.toString();

                if (!chats.has(chatKey)) {
                    chats.set(chatKey, {
                        id: chat.id,
                        type: chat.type,
                        title: chat.title || `${chat.first_name || ''} ${chat.last_name || ''}`.trim(),
                    });
                }
            }
        });

        if (chats.size === 0) {
            console.log('⚠️  No chat information found in recent updates.');
            process.exit(0);
        }

        console.log('📋 Available chats:\n');
        console.log('='.repeat(60));

        chats.forEach((chat) => {
            const typeEmoji = chat.type === 'private' ? '👤' :
                chat.type === 'group' ? '👥' :
                    chat.type === 'supergroup' ? '👥🔒' : '📢';

            console.log(`${typeEmoji} ${chat.type.toUpperCase()}`);
            console.log(`   Name: ${chat.title}`);
            console.log(`   Chat ID: ${chat.id}`);
            console.log('');
        });

        console.log('='.repeat(60));
        console.log('\n💡 使用说明：');
        console.log('1. 找到您的群组对应的 Chat ID');
        console.log('2. 将 Chat ID 复制到 .env 文件中：');
        console.log('   TELEGRAM_CHAT_ID="<Chat ID>"');
        console.log('');
        console.log('注意：');
        console.log('- 超级群组（supergroup）的 ID 通常以 -100 开头');
        console.log('- 普通群组（group）的 ID 是较短的负数');
        console.log('- 私聊（private）的 ID 是正数');

        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error fetching updates:');
        console.error(error.message);
        console.log('\n请检查：');
        console.log('1. Bot Token 是否正确');
        console.log('2. 网络连接是否正常');
        process.exit(1);
    });
