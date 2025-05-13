# Market Data API Scripts

This directory contains scripts for interacting with market data APIs (Kotak and Dhan) to fetch real-time and historical data for paper trading.

## Prerequisites

1. Node.js installed (v14 or higher)
2. Required npm packages:
   ```
   npm install axios ws dotenv readline
   ```
3. API credentials in `.env` file (see Configuration section)

## Configuration

Create or update your `.env` file with the following variables:

```
# Market Data Provider
MARKET_DATA_PROVIDER=kotak  # Options: 'kotak' or 'dhan'
USE_MOCK_DATA=false

# Kotak API Configuration
KOTAK_API_URL=https://tradeapi.kotaksecurities.com/apim
KOTAK_WS_URL=wss://websocket.kotaksecurities.com/feed
KOTAK_USER_ID=your_kotak_user_id
KOTAK_PASSWORD=your_kotak_password
KOTAK_TOTP_CODE=your_totp_code

# Dhan API Configuration
DHAN_API_URL=https://api.dhan.co
DHAN_WS_URL=wss://stream.dhan.co
DHAN_CLIENT_ID=your_dhan_client_id
DHAN_CLIENT_SECRET=your_dhan_client_secret
```

## Available Scripts

### 1. Search for Contracts

This script searches for contracts based on a query string.

```bash
node scripts/search-contracts.js [--provider=kotak|dhan] [--query="NIFTY 24000 CE"]
```

**Features:**
- Searches for contracts matching the query
- Displays contract details in a table format
- Option to save results to a JSON file
- Provides token for use with other scripts

### 2. Fetch Real-time Data

This script fetches real-time market data for a specific token.

```bash
node scripts/fetch-realtime-data.js [--provider=kotak|dhan] [--token=43854] [--duration=60]
```

**Features:**
- Connects to WebSocket for real-time updates
- Displays price updates as they arrive
- Calculates statistics (min, max, avg, range)
- Option to save data to a JSON file

### 3. Fetch Historical Data

This script fetches historical OHLC data for a specific token.

```bash
node scripts/fetch-historical-data.js [--provider=kotak|dhan] [--token=43854] [--interval=day|hour|minute] [--from=YYYY-MM-DD] [--to=YYYY-MM-DD]
```

**Features:**
- Fetches historical data for specified date range
- Supports different intervals (day, hour, minute)
- Displays data summary and statistics
- Option to save data to a JSON file

### 4. Monitor Multiple Contracts

This script monitors multiple contracts simultaneously.

```bash
node scripts/monitor-multiple-contracts.js [--provider=kotak|dhan] [--tokens=43854,43855,43856] [--duration=60]
```

**Features:**
- Monitors multiple tokens in real-time
- Displays price updates in a table format
- Calculates statistics for each token
- Option to save data to a JSON file

## Workflow Example

1. **Find contract tokens:**
   ```bash
   node scripts/search-contracts.js --query="NIFTY 24000 CE"
   ```

2. **Monitor real-time data:**
   ```bash
   node scripts/fetch-realtime-data.js --token=43854 --duration=300
   ```

3. **Get historical data:**
   ```bash
   node scripts/fetch-historical-data.js --token=43854 --interval=day --from=2023-01-01 --to=2023-01-31
   ```

4. **Monitor multiple contracts:**
   ```bash
   node scripts/monitor-multiple-contracts.js --tokens=43854,43855,43856 --duration=300
   ```

## Integration with Paper Trading Platform

These scripts can be used to:

1. **Find Contract Tokens**: Use `search-contracts.js` to find tokens for contracts you want to trade
2. **Test Market Data**: Use `fetch-realtime-data.js` to verify that you can receive real-time updates
3. **Analyze Historical Data**: Use `fetch-historical-data.js` to analyze past performance
4. **Monitor Multiple Positions**: Use `monitor-multiple-contracts.js` to track multiple positions

The data fetched by these scripts can be used to:
- Validate the paper trading platform's price data
- Backtest trading strategies
- Monitor real-time market conditions
- Make informed trading decisions

## Troubleshooting

### Authentication Issues

- Verify your API credentials in the `.env` file
- Ensure your TOTP code is current (for Kotak API)
- Check if your API access is active and not expired

### WebSocket Connection Issues

- Check your internet connection
- Verify the WebSocket URL is correct
- Ensure your authentication token is valid

### No Data Received

- Verify the token is correct and active
- Check if the market is open
- Try a different token or contract

### Rate Limiting

- Reduce the frequency of API calls
- Implement exponential backoff for retries
- Contact your API provider for rate limit details
