require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MORPHO_VAULT_ADDRESS = '0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A';
const MORPHO_API_URL = 'https://api.morpho.org/graphql';
const DAILY_REPORT_HOUR = 9; // 每天上午9点推送日报

// Initialize Telegram Bot
let bot = null;
if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
    console.log('Telegram notifications enabled');
} else {
    console.log('Telegram notifications disabled (no credentials provided)');
}

// Send Telegram message
async function sendTelegramMessage(message) {
    if (!bot) return;
    try {
        await bot.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' });
        console.log('Telegram message sent');
    } catch (error) {
        console.error('Failed to send Telegram message:', error.message);
    }
}

// Fetch vault data from Morpho API
async function fetchVaultData() {
    const query = `
        query GetVault {
            vaultByAddress(chainId: 8453, address: "${MORPHO_VAULT_ADDRESS.toLowerCase()}") {
                address
                name
                state {
                    totalAssets
                    netApy
                    apy
                    allocation {
                        market {
                            uniqueKey
                            state {
                                supplyAssets
                                borrowAssets
                            }
                        }
                        supplyAssets
                    }
                }
            }
        }
    `;

    const response = await fetch(MORPHO_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
    });

    if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    const vault = data.data.vaultByAddress;
    if (!vault || !vault.state) return null;

    const vaultName = vault.name;
    const totalAssets = parseFloat(vault.state.totalAssets) / 1e6;
    
    // Get APY (netApy includes rewards, apy is base rate)
    // API returns as decimal (e.g., 0.0645 = 6.45%)
    const supplyAPY = vault.state.netApy ? parseFloat(vault.state.netApy) * 100 : 
                      vault.state.apy ? parseFloat(vault.state.apy) * 100 : 0;

    let availableLiquidity = 0;
    if (vault.state.allocation && Array.isArray(vault.state.allocation)) {
        for (const alloc of vault.state.allocation) {
            if (alloc.market?.state) {
                const marketSupply = parseFloat(alloc.market.state.supplyAssets) / 1e6;
                const marketBorrow = parseFloat(alloc.market.state.borrowAssets) / 1e6;
                const vaultSupply = parseFloat(alloc.supplyAssets) / 1e6;
                const marketLiquidity = marketSupply - marketBorrow;
                availableLiquidity += Math.min(marketLiquidity, vaultSupply);
            }
        }
    }

    const deployedAssets = totalAssets - availableLiquidity;
    const utilizationRatePercent = totalAssets > 0 ? (deployedAssets / totalAssets) * 100 : 0;

    return { vaultName, totalAssets, availableLiquidity, deployedAssets, utilizationRatePercent, supplyAPY };
}

// Main monitoring function
async function main(isDailyReport = false) {
    console.log(`Fetching Morpho Vault Data on Base...`);

    try {
        const data = await fetchVaultData();
        if (!data) {
            console.error('Failed to fetch vault data from Morpho API');
            return;
        }

        const { vaultName, totalAssets, availableLiquidity, deployedAssets, utilizationRatePercent, supplyAPY } = data;
        const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

        console.log(`\n--- Morpho Vault Monitor (Base) ---`);
        console.log(`Vault Name:                     ${vaultName}`);
        console.log(`Total Deposits (Total Assets):  ${totalAssets.toLocaleString()} USDC`);
        console.log(`Liquidity (Available):          ${availableLiquidity.toLocaleString()} USDC`);
        console.log(`Deployed/Borrowed Assets:       ${deployedAssets.toLocaleString()} USDC`);
        console.log(`Utilization Rate:               ${utilizationRatePercent.toFixed(2)}%`);
        console.log(`Supply APY:                     ${supplyAPY.toFixed(2)}%`);

        // Daily report at 9am
        if (isDailyReport) {
            const status = utilizationRatePercent > 95 ? '🚨 CRITICAL' :
                          utilizationRatePercent > 90 ? '⚠️ WARNING' : '✅ Normal';
            const message = `📋 *MORPHO Vault 日报*\n\n` +
                `🏦 Vault: *${vaultName}*\n` +
                `⏰ ${timestamp}\n` +
                `📊 Utilization: *${utilizationRatePercent.toFixed(2)}%*\n` +
                `💹 Supply APY: *${supplyAPY.toFixed(2)}%*\n` +
                `💰 Total Deposits: ${totalAssets.toLocaleString()} USDC\n` +
                `✅ Available: ${availableLiquidity.toLocaleString()} USDC\n` +
                `📈 Deployed: ${deployedAssets.toLocaleString()} USDC\n\n` +
                `Status: ${status}`;
            await sendTelegramMessage(message);
            console.log('[DAILY REPORT] Sent');
            return;
        }

        // Threshold alerts
        if (utilizationRatePercent > 95) {
            console.error(`\n[CRITICAL ALERT] Utilization Rate is above 95%!`);
            const message = `🚨 *MORPHO CRITICAL ALERT*\n\n` +
                `🏦 Vault: *${vaultName}*\n` +
                `⏰ ${timestamp}\n` +
                `📊 Utilization Rate: *${utilizationRatePercent.toFixed(2)}%*\n` +
                `💹 Supply APY: *${supplyAPY.toFixed(2)}%*\n\n` +
                `💰 Total Deposits: ${totalAssets.toLocaleString()} USDC\n` +
                `✅ Available: ${availableLiquidity.toLocaleString()} USDC\n` +
                `📈 Deployed: ${deployedAssets.toLocaleString()} USDC`;
            await sendTelegramMessage(message);
        } else if (utilizationRatePercent > 90) {
            console.warn(`\n[WARNING] Utilization Rate is above 90%.`);
            const message = `⚠️ *MORPHO WARNING ALERT*\n\n` +
                `🏦 Vault: *${vaultName}*\n` +
                `⏰ ${timestamp}\n` +
                `📊 Utilization Rate: *${utilizationRatePercent.toFixed(2)}%*\n` +
                `💹 Supply APY: *${supplyAPY.toFixed(2)}%*\n\n` +
                `💰 Total Deposits: ${totalAssets.toLocaleString()} USDC\n` +
                `✅ Available: ${availableLiquidity.toLocaleString()} USDC\n` +
                `📈 Deployed: ${deployedAssets.toLocaleString()} USDC`;
            await sendTelegramMessage(message);
        } else {
            console.log(`\nStatus: Normal (Utilization < 90%)`);
        }
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

// Schedule daily report at 9am (Asia/Shanghai)
function scheduleDailyReport() {
    const checkInterval = 60000; // Check every minute
    setInterval(() => {
        const now = new Date();
        const shanghaiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
        if (shanghaiTime.getHours() === DAILY_REPORT_HOUR && shanghaiTime.getMinutes() === 0) {
            console.log('\n[SCHEDULER] Triggering daily report...');
            main(true);
        }
    }, checkInterval);
    console.log(`Daily report scheduled at ${DAILY_REPORT_HOUR}:00 (Asia/Shanghai)`);
}

// Run immediately, then every 10 minutes, plus daily report
main();
setInterval(main, 600000);
scheduleDailyReport();
