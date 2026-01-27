require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MORPHO_API_URL = 'https://api.morpho.org/graphql';
const DAILY_REPORT_HOUR = 9;
const lastAlertTimes = {};

// Morpho Vaults on Base chain
const VAULTS = [
    {
        address: '0xeE8F4eC5672F09119b96Ab6fB59C27E1b7e44b61',
        name: 'Gauntlet USDC Prime'
    },
    {
        address: '0xBEEFE94c8aD530842bfE7d8B397938fFc1cb83b2',
        name: 'Steakhouse Prime USDC'
    }
];

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

// Fetch single vault data from Morpho API
async function fetchVaultData(vaultAddress) {
    const query = `
        query GetVault {
            vaultByAddress(chainId: 8453, address: "${vaultAddress.toLowerCase()}") {
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

// Fetch all vaults data
async function fetchAllVaultsData() {
    const results = [];
    for (const vault of VAULTS) {
        try {
            const data = await fetchVaultData(vault.address);
            if (data) {
                results.push(data);
            } else {
                console.error(`Failed to fetch data for ${vault.name}`);
            }
        } catch (error) {
            console.error(`Error fetching ${vault.name}:`, error.message);
        }
    }
    return results;
}

// Main monitoring function
async function main(isDailyReport = false) {
    console.log(`Fetching Morpho Vaults Data on Base...`);

    try {
        const vaultsData = await fetchAllVaultsData();
        if (vaultsData.length === 0) {
            console.error('Failed to fetch any vault data from Morpho API');
            return;
        }

        const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

        // Console output for each vault
        for (const data of vaultsData) {
            const { vaultName, totalAssets, availableLiquidity, deployedAssets, utilizationRatePercent, supplyAPY } = data;
            console.log(`\n--- Morpho: ${vaultName} (Base) ---`);
            console.log(`Total Deposits:    ${totalAssets.toLocaleString()} USDC`);
            console.log(`Available:         ${availableLiquidity.toLocaleString()} USDC`);
            console.log(`Deployed:          ${deployedAssets.toLocaleString()} USDC`);
            console.log(`Utilization Rate:  ${utilizationRatePercent.toFixed(2)}%`);
            console.log(`Supply APY:        ${supplyAPY.toFixed(2)}%`);
        }

        // Daily report - send combined message for all vaults
        if (isDailyReport) {
            let message = `📋 *MORPHO Vaults 日报*\n⏰ ${timestamp}\n`;

            for (const data of vaultsData) {
                const { vaultName, totalAssets, availableLiquidity, utilizationRatePercent, supplyAPY } = data;
                const status = utilizationRatePercent > 95 ? '🚨' :
                    utilizationRatePercent > 90 ? '⚠️' : '✅';
                message += `\n━━━━━━━━━━━━━━━━\n` +
                    `🏦 *${vaultName}*\n` +
                    `📊 Utilization: *${utilizationRatePercent.toFixed(2)}%* ${status}\n` +
                    `💹 Supply APY: *${supplyAPY.toFixed(2)}%*\n` +
                    `💰 Total: ${totalAssets.toLocaleString()} USDC\n` +
                    `✅ Available: ${availableLiquidity.toLocaleString()} USDC`;
            }

            await sendTelegramMessage(message);
            console.log('\n[DAILY REPORT] Sent');
            return;
        }

        // Threshold alerts for each vault
        const now = Date.now();
        const COOLDOWN_PERIOD = 3600000; // 1 hour in milliseconds

        for (const data of vaultsData) {
            const { vaultName, totalAssets, availableLiquidity, deployedAssets, utilizationRatePercent, supplyAPY } = data;

            // Initialize last alert time for this vault if not exists
            if (!lastAlertTimes[vaultName]) {
                lastAlertTimes[vaultName] = 0;
            }

            if (utilizationRatePercent > 95) {
                if (now - lastAlertTimes[vaultName] >= COOLDOWN_PERIOD) {
                    console.error(`\n[CRITICAL ALERT] ${vaultName} Utilization Rate is above 95%!`);
                    const message = `🚨 *MORPHO CRITICAL ALERT*\n\n` +
                        `🏦 Vault: *${vaultName}*\n` +
                        `⏰ ${timestamp}\n` +
                        `📊 Utilization Rate: *${utilizationRatePercent.toFixed(2)}%*\n` +
                        `💹 Supply APY: *${supplyAPY.toFixed(2)}%*\n\n` +
                        `💰 Total Deposits: ${totalAssets.toLocaleString()} USDC\n` +
                        `✅ Available: ${availableLiquidity.toLocaleString()} USDC\n` +
                        `📈 Deployed: ${deployedAssets.toLocaleString()} USDC`;
                    await sendTelegramMessage(message);
                    lastAlertTimes[vaultName] = now;
                } else {
                    console.log(`\n[CRITICAL ALERT] ${vaultName} Utilization > 95% but inside cooldown period.`);
                }
            } else if (utilizationRatePercent > 90) {
                if (now - lastAlertTimes[vaultName] >= COOLDOWN_PERIOD) {
                    console.warn(`\n[WARNING] ${vaultName} Utilization Rate is above 90%.`);
                    const message = `⚠️ *MORPHO WARNING ALERT*\n\n` +
                        `🏦 Vault: *${vaultName}*\n` +
                        `⏰ ${timestamp}\n` +
                        `📊 Utilization Rate: *${utilizationRatePercent.toFixed(2)}%*\n` +
                        `💹 Supply APY: *${supplyAPY.toFixed(2)}%*\n\n` +
                        `💰 Total Deposits: ${totalAssets.toLocaleString()} USDC\n` +
                        `✅ Available: ${availableLiquidity.toLocaleString()} USDC\n` +
                        `📈 Deployed: ${deployedAssets.toLocaleString()} USDC`;
                    await sendTelegramMessage(message);
                    lastAlertTimes[vaultName] = now;
                } else {
                    console.log(`\n[WARNING] ${vaultName} Utilization > 90% but inside cooldown period.`);
                }
            } else {
                console.log(`Status: ${vaultName} Normal (Utilization < 90%)`);
            }
        }
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

// Schedule daily report at 9am (Asia/Shanghai)
function scheduleDailyReport() {
    const checkInterval = 60000;
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
