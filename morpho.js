require('dotenv').config();
const { ethers } = require('ethers');
const TelegramBot = require('node-telegram-bot-api');

// Configuration
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MORPHO_VAULT_ADDRESS = '0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A'; // Morpho x Spark USDC Vault on Base
const MORPHO_API_URL = 'https://api.morpho.org/graphql';

// Initialize Telegram Bot (only if credentials are provided)
let bot = null;
if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
    console.log('Telegram notifications enabled');
} else {
    console.log('Telegram notifications disabled (no credentials provided)');
}

// Function to send Telegram alert
async function sendTelegramAlert(vaultName, level, utilizationRate, totalAssets, availableLiquidity, deployedAssets) {
    if (!bot) return; // Skip if Telegram is not configured

    const emoji = level === 'CRITICAL' ? '🚨' : '⚠️';
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    const message = `${emoji} *MORPHO ${level} ALERT*\n\n` +
        `🏦 Vault: *${vaultName}*\n` +
        `⏰ Time: ${timestamp}\n` +
        `📊 Utilization Rate: *${utilizationRate.toFixed(2)}%*\n\n` +
        `💰 Total Deposits: ${totalAssets.toLocaleString()} USDC\n` +
        `✅ Available Liquidity: ${availableLiquidity.toLocaleString()} USDC\n` +
        `📈 Deployed/Borrowed: ${deployedAssets.toLocaleString()} USDC`;

    try {
        await bot.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' });
        console.log('Telegram alert sent successfully');
    } catch (error) {
        console.error('Failed to send Telegram alert:', error.message);
    }
}

// Function to fetch vault data from Morpho API
async function fetchVaultDataFromAPI() {
    const query = `
        query GetVault {
            vaultByAddress(chainId: 8453, address: "${MORPHO_VAULT_ADDRESS.toLowerCase()}") {
                address
                name
                state {
                    totalAssets
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

    try {
        const response = await fetch(MORPHO_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.errors) {
            throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
        }

        return data.data.vaultByAddress;
    } catch (error) {
        console.error('Error fetching from Morpho API:', error.message);
        return null;
    }
}

async function main() {
    console.log(`Fetching Morpho Vault Data on Base...`);

    try {
        // Try to fetch data from Morpho API first
        const vaultData = await fetchVaultDataFromAPI();

        if (vaultData && vaultData.state) {
            const vaultName = vaultData.name;
            // API returns values in smallest unit (6 decimals for USDC)
            const totalAssets = parseFloat(vaultData.state.totalAssets) / 1e6;

            // Calculate available liquidity from allocations
            let availableLiquidity = 0;
            if (vaultData.state.allocation && Array.isArray(vaultData.state.allocation)) {
                for (const alloc of vaultData.state.allocation) {
                    if (alloc.market && alloc.market.state) {
                        const marketSupply = parseFloat(alloc.market.state.supplyAssets) / 1e6;
                        const marketBorrow = parseFloat(alloc.market.state.borrowAssets) / 1e6;
                        const vaultSupply = parseFloat(alloc.supplyAssets) / 1e6;

                        // Available liquidity in this market = min(market liquidity, vault supply)
                        const marketLiquidity = marketSupply - marketBorrow;
                        const withdrawable = Math.min(marketLiquidity, vaultSupply);
                        availableLiquidity += withdrawable;
                    }
                }
            }

            const deployedAssets = totalAssets - availableLiquidity;

            // Calculate utilization rate
            let utilizationRate = 0;
            if (totalAssets > 0) {
                utilizationRate = deployedAssets / totalAssets;
            }

            const utilizationRatePercent = utilizationRate * 100;

            console.log(`\n--- Morpho Vault Monitor (Base) ---`);
            console.log(`Vault Name:                     ${vaultName}`);
            console.log(`Total Deposits (Total Assets):  ${totalAssets.toLocaleString()} USDC`);
            console.log(`Liquidity (Available):          ${availableLiquidity.toLocaleString()} USDC`);
            console.log(`Deployed/Borrowed Assets:       ${deployedAssets.toLocaleString()} USDC`);
            console.log(`Utilization Rate:               ${utilizationRatePercent.toFixed(2)}%`);

            // Alerts
            if (utilizationRatePercent > 95) {
                console.error(`\n[CRITICAL ALERT] Utilization Rate is above 95%! Current: ${utilizationRatePercent.toFixed(2)}%`);
                await sendTelegramAlert('CRITICAL', utilizationRatePercent, totalAssets, availableLiquidity, deployedAssets);
            } else if (utilizationRatePercent > 90) {
                console.warn(`\n[WARNING] Utilization Rate is above 90%. Current: ${utilizationRatePercent.toFixed(2)}%`);
                await sendTelegramAlert('WARNING', utilizationRatePercent, totalAssets, availableLiquidity, deployedAssets);
            } else {
                console.log(`\nStatus: Normal (Utilization < 90%)`);
            }
        } else {
            console.error('Failed to fetch vault data from Morpho API');
        }

    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

// Run immediately and then every 10 minutes
main();
setInterval(main, 600000); // 600000ms = 10 minutes
