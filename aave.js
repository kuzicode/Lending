require('dotenv').config();
const { ethers } = require('ethers');
const TelegramBot = require('node-telegram-bot-api');

// Configuration
const RPC_URL = process.env.RPC_URL;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const POOL_ADDRESS = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2'; // Aave V3 Pool on Ethereum Mainnet (correct address)
const USDC_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

// Initialize Telegram Bot (only if credentials are provided)
let bot = null;
if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
    console.log('Telegram notifications enabled');
} else {
    console.log('Telegram notifications disabled (no credentials provided)');
}

// Minimal ABI for Pool contract
const POOL_ABI = [
    "function getReserveData(address asset) external view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))"
];

// Minimal ABI for ERC20 tokens (aToken, debtTokens)
const ERC20_ABI = [
    "function totalSupply() external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)"
];

// Function to send Telegram alert
async function sendTelegramAlert(level, utilizationRate, totalLiquidity, availableLiquidity, totalDebt) {
    if (!bot) return; // Skip if Telegram is not configured

    const emoji = level === 'CRITICAL' ? '🚨' : '⚠️';
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    const message = `${emoji} *AAVE USDC ${level} ALERT*\n\n` +
        `⏰ Time: ${timestamp}\n` +
        `📊 Utilization Rate: *${utilizationRate.toFixed(2)}%*\n\n` +
        `💰 Total Liquidity: ${totalLiquidity.toLocaleString()} USDC\n` +
        `✅ Available: ${availableLiquidity.toLocaleString()} USDC\n` +
        `📈 Total Debt: ${totalDebt.toLocaleString()} USDC`;

    try {
        await bot.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' });
        console.log('Telegram alert sent successfully');
    } catch (error) {
        console.error('Failed to send Telegram alert:', error.message);
    }
}

async function main() {
    if (!RPC_URL) {
        console.error("Please set RPC_URL in .env file");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);

    console.log(`Fetching AAVE V3 USDC Pool Data...`);

    try {
        // Get reserve data from Pool contract
        const reserveData = await pool.getReserveData(USDC_ADDRESS);

        // Get total supply from aToken (represents total liquidity deposited)
        const aToken = new ethers.Contract(reserveData.aTokenAddress, ERC20_ABI, provider);
        const aTokenSupply = await aToken.totalSupply();

        // Get total debt from debt tokens
        const variableDebtToken = new ethers.Contract(reserveData.variableDebtTokenAddress, ERC20_ABI, provider);
        const stableDebtToken = new ethers.Contract(reserveData.stableDebtTokenAddress, ERC20_ABI, provider);

        const totalVariableDebt = await variableDebtToken.totalSupply();
        const totalStableDebt = await stableDebtToken.totalSupply();

        // Get available liquidity (USDC balance of aToken contract)
        const usdcToken = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
        const availableLiquidity = await usdcToken.balanceOf(reserveData.aTokenAddress);

        // USDC has 6 decimals
        const decimals = 6;

        // Calculate totals
        const totalDebt = totalVariableDebt + totalStableDebt;
        const totalLiquidity = aTokenSupply; // aToken supply represents total deposited

        // Convert to human readable
        const availableLiquidityFloat = Number(ethers.formatUnits(availableLiquidity, decimals));
        const totalDebtFloat = Number(ethers.formatUnits(totalDebt, decimals));
        const totalLiquidityFloat = Number(ethers.formatUnits(totalLiquidity, decimals));

        // Calculate utilization rate
        let utilizationRate = 0;
        if (totalLiquidityFloat > 0) {
            utilizationRate = totalDebtFloat / totalLiquidityFloat;
        }

        const utilizationRatePercent = utilizationRate * 100;

        console.log(`\n--- AAVE V3 USDC Monitor ---`);
        console.log(`Total Liquidity (Reserve Size): ${totalLiquidityFloat.toLocaleString()} USDC`);
        console.log(`Available Liquidity:            ${availableLiquidityFloat.toLocaleString()} USDC`);
        console.log(`Total Debt:                     ${totalDebtFloat.toLocaleString()} USDC`);
        console.log(`Utilization Rate:               ${utilizationRatePercent.toFixed(2)}%`);

        // Alerts
        if (utilizationRatePercent > 95) {
            console.error(`\n[CRITICAL ALERT] Utilization Rate is above 95%! Current: ${utilizationRatePercent.toFixed(2)}%`);
            await sendTelegramAlert('CRITICAL', utilizationRatePercent, totalLiquidityFloat, availableLiquidityFloat, totalDebtFloat);
        } else if (utilizationRatePercent > 90) {
            console.warn(`\n[WARNING] Utilization Rate is above 90%. Current: ${utilizationRatePercent.toFixed(2)}%`);
            await sendTelegramAlert('WARNING', utilizationRatePercent, totalLiquidityFloat, availableLiquidityFloat, totalDebtFloat);
        } else {
            console.log(`\nStatus: Normal (Utilization < 90%)`);
        }

    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

// Run immediately and then every 10 minutes
main();
setInterval(main, 600000); // 600000ms = 10 minutes
