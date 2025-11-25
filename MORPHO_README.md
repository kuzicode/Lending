# Morpho Vault Monitor (Base Chain)

## Overview
This script monitors the Morpho x Spark USDC Vault on Base chain and sends Telegram alerts when utilization rate exceeds certain thresholds.

## Vault Information
- **Chain**: Base
- **Vault Address**: `0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A`
- **Vault Name**: Spark USDC Vault
- **Asset**: USDC
- **Vault URL**: https://app.morpho.org/base/vault/0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A/spark-usdc-vault

## How It Works
The script uses Morpho's GraphQL API to monitor the vault:

1. **Total Assets**: Gets the total USDC managed by the vault from the API
2. **Available Liquidity**: Calculates available liquidity by querying all market allocations:
   - For each market in the vault's allocation
   - Gets market supply and borrow assets
   - Calculates market liquidity (supply - borrow)
   - Takes the minimum of market liquidity and vault's supply in that market
   - Sums up all withdrawable amounts
3. **Deployed Assets**: Calculates assets actively deployed (Total Assets - Available Liquidity)
4. **Utilization Rate**: Calculates the percentage of assets deployed (Deployed Assets / Total Assets × 100%)

## Alert Thresholds
- **WARNING** (⚠️): Utilization Rate > 90%
- **CRITICAL** (🚨): Utilization Rate > 95%

## Configuration
The script requires the following environment variables in `.env`:

```bash
# Base Chain RPC URL
BASE_RPC_URL="https://mainnet.base.org"

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN="your_bot_token"
TELEGRAM_CHAT_ID="your_chat_id"
```

## Running the Script

### Start Monitoring
```bash
node morpho.js
```

The script will:
- Run immediately upon start
- Check the vault status every 10 minutes
- Send Telegram alerts when thresholds are exceeded
- Display status in the console

### Example Output
```
--- Morpho Vault Monitor (Base) ---
Vault Name:                     Spark USDC Vault
Total Deposits (Total Assets):  308,738,080.524 USDC
Liquidity (Available):          102,387,794.389 USDC
Deployed/Borrowed Assets:       206,350,286.135 USDC
Utilization Rate:               66.84%

Status: Normal (Utilization < 90%)
```

## Technical Details

### Morpho GraphQL API
The script uses Morpho's official GraphQL API at `https://api.morpho.org/graphql`:
- Queries vault data by address and chain ID
- Retrieves allocation data for all markets
- Calculates available liquidity from market states

### Utilization Calculation
```
Utilization Rate = (Deployed Assets / Total Assets) × 100%
Deployed Assets = Total Assets - Idle Liquidity
```

### Monitoring Interval
The script checks the vault status every 10 minutes (600,000 milliseconds).

## Differences from AAVE Monitor
- **Chain**: Base instead of Ethereum Mainnet
- **Protocol**: Morpho (ERC-4626 vault) instead of AAVE V3 (lending pool)
- **Data Source**: Uses Morpho GraphQL API instead of direct contract calls
- **Metrics**: Calculates available liquidity from market allocations instead of using debt tokens
- **Calculation**: Utilization based on deployed vs available assets across multiple markets

## Notes
- The script uses Morpho's official GraphQL API for reliable data
- Available liquidity is calculated by summing withdrawable amounts from all allocated markets
- For each market, withdrawable amount = min(market liquidity, vault supply in that market)
- High utilization (>95%) may indicate limited withdrawal capacity
- The monitoring interval is 10 minutes (same as AAVE monitor)
