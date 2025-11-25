require('dotenv').config();
const { ethers } = require('ethers');
const TelegramBot = require('node-telegram-bot-api');

// Configuration
const RPC_URL = process.env.RPC_URL;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const POOL_ADDRESS = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2';
const USDC_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const DAILY_REPORT_HOUR = 9;

// Constants for APY calculation
const RAY = 10n ** 27n; // AAVE uses 27 decimals for rates
const SECONDS_PER_YEAR = 31536000;

// Initialize Telegram Bot
let bot = null;
if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
    console.log('Telegram notifications enabled');
} else {
    console.log('Telegram notifications disabled (no credentials provided)');
}

// ABIs
const POOL_ABI = [
    "function getReserveData(address asset) external view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))"
];

const ERC20_ABI = [
    "function totalSupply() external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)"
];

// Convert Ray rate to APY percentage
// APY = (1 + rate/SECONDS_PER_YEAR)^SECONDS_PER_YEAR - 1
function rayRateToAPY(rayRate) {
    const ratePerSecond = Number(rayRate) / Number(RAY);
    const apy = (Math.pow(1 + ratePerSecond / SECONDS_PER_YEAR, SECONDS_PER_YEAR) - 1) * 100;
    return apy;
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

// Fetch pool data
async function fetchPoolData() {
    if (!RPC_URL) {
        console.error("Please set RPC_URL in .env file");
        return null;
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);

    const reserveData = await pool.getReserveData(USDC_ADDRESS);
    
    // Extract Supply APY from reserveData
    const supplyAPY = rayRateToAPY(reserveData.currentLiquidityRate);

    const aToken = new ethers.Contract(reserveData.aTokenAddress, ERC20_ABI, provider);
    const variableDebtToken = new ethers.Contract(reserveData.variableDebtTokenAddress, ERC20_ABI, provider);
    const stableDebtToken = new ethers.Contract(reserveData.stableDebtTokenAddress, ERC20_ABI, provider);
    const usdcToken = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);

    const [aTokenSupply, totalVariableDebt, totalStableDebt, availableLiquidity] = await Promise.all([
        aToken.totalSupply(),
        variableDebtToken.totalSupply(),
        stableDebtToken.totalSupply(),
        usdcToken.balanceOf(reserveData.aTokenAddress)
    ]);

    const decimals = 6;
    const totalDebt = totalVariableDebt + totalStableDebt;
    const totalLiquidity = aTokenSupply;

    const availableLiquidityFloat = Number(ethers.formatUnits(availableLiquidity, decimals));
    const totalDebtFloat = Number(ethers.formatUnits(totalDebt, decimals));
    const totalLiquidityFloat = Number(ethers.formatUnits(totalLiquidity, decimals));
    const utilizationRatePercent = totalLiquidityFloat > 0 ? (totalDebtFloat / totalLiquidityFloat) * 100 : 0;

    return {
        totalLiquidityFloat,
        availableLiquidityFloat,
        totalDebtFloat,
        utilizationRatePercent,
        supplyAPY
    };
}

// Main monitoring function
async function main(isDailyReport = false) {
    console.log(`Fetching AAVE V3 USDC Pool Data...`);

    try {
        const data = await fetchPoolData();
        if (!data) return;

        const {
            totalLiquidityFloat,
            availableLiquidityFloat,
            totalDebtFloat,
            utilizationRatePercent,
            supplyAPY
        } = data;
        const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

        console.log(`\n--- AAVE V3 USDC Monitor ---`);
        console.log(`Total Liquidity (Reserve Size): ${totalLiquidityFloat.toLocaleString()} USDC`);
        console.log(`Available Liquidity:            ${availableLiquidityFloat.toLocaleString()} USDC`);
        console.log(`Total Debt:                     ${totalDebtFloat.toLocaleString()} USDC`);
        console.log(`Utilization Rate:               ${utilizationRatePercent.toFixed(2)}%`);
        console.log(`Supply APY:                     ${supplyAPY.toFixed(2)}%`);

        // Daily report at 9am
        if (isDailyReport) {
            const status = utilizationRatePercent > 95 ? '🚨 CRITICAL' :
                          utilizationRatePercent > 90 ? '⚠️ WARNING' : '✅ Normal';
            const message = `📋 *AAVE USDC 日报*\n\n` +
                `⏰ ${timestamp}\n` +
                `📊 Utilization: *${utilizationRatePercent.toFixed(2)}%*\n` +
                `💹 Supply APY: *${supplyAPY.toFixed(2)}%*\n` +
                `💰 Total Liquidity: ${totalLiquidityFloat.toLocaleString()} USDC\n` +
                `✅ Available: ${availableLiquidityFloat.toLocaleString()} USDC\n` +
                `📈 Total Debt: ${totalDebtFloat.toLocaleString()} USDC\n\n` +
                `Status: ${status}`;
            await sendTelegramMessage(message);
            console.log('[DAILY REPORT] Sent');
            return;
        }

        // Threshold alerts
        if (utilizationRatePercent > 95) {
            console.error(`\n[CRITICAL ALERT] Utilization Rate is above 95%!`);
            const message = `🚨 *AAVE USDC CRITICAL ALERT*\n\n` +
                `⏰ ${timestamp}\n` +
                `📊 Utilization Rate: *${utilizationRatePercent.toFixed(2)}%*\n` +
                `💹 Supply APY: *${supplyAPY.toFixed(2)}%*\n\n` +
                `💰 Total Liquidity: ${totalLiquidityFloat.toLocaleString()} USDC\n` +
                `✅ Available: ${availableLiquidityFloat.toLocaleString()} USDC\n` +
                `📈 Total Debt: ${totalDebtFloat.toLocaleString()} USDC`;
            await sendTelegramMessage(message);
        } else if (utilizationRatePercent > 90) {
            console.warn(`\n[WARNING] Utilization Rate is above 90%.`);
            const message = `⚠️ *AAVE USDC WARNING ALERT*\n\n` +
                `⏰ ${timestamp}\n` +
                `📊 Utilization Rate: *${utilizationRatePercent.toFixed(2)}%*\n` +
                `💹 Supply APY: *${supplyAPY.toFixed(2)}%*\n\n` +
                `💰 Total Liquidity: ${totalLiquidityFloat.toLocaleString()} USDC\n` +
                `✅ Available: ${availableLiquidityFloat.toLocaleString()} USDC\n` +
                `📈 Total Debt: ${totalDebtFloat.toLocaleString()} USDC`;
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
