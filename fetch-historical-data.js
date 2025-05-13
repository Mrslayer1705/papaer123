/**
 * Script to fetch historical market data from Kotak/Dhan API
 * 
 * This script demonstrates how to:
 * 1. Authenticate with the API
 * 2. Fetch historical OHLC data for a specific token
 * 3. Process and display the data
 * 
 * Usage:
 * node scripts/fetch-historical-data.js [--provider=kotak|dhan] [--token=43854] [--interval=day|hour|minute] [--from=YYYY-MM-DD] [--to=YYYY-MM-DD]
 */

require('dotenv').config();
const axios = require('axios');
const readline = require('readline');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value;
  return acc;
}, {});

// Configuration
const provider = args.provider || process.env.MARKET_DATA_PROVIDER || 'kotak';
const token = args.token || '43854'; // Default to NIFTY 24000 CE
const interval = args.interval || 'day'; // day, hour, minute
const fromDate = args.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Default to 30 days ago
const toDate = args.to || new Date().toISOString().split('T')[0]; // Default to today

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// API configuration
const config = {
  kotak: {
    apiUrl: process.env.KOTAK_API_URL || 'https://tradeapi.kotaksecurities.com/apim',
    userId: process.env.KOTAK_USER_ID,
    password: process.env.KOTAK_PASSWORD,
    totpCode: process.env.KOTAK_TOTP_CODE
  },
  dhan: {
    apiUrl: process.env.DHAN_API_URL || 'https://api.dhan.co',
    clientId: process.env.DHAN_CLIENT_ID,
    clientSecret: process.env.DHAN_CLIENT_SECRET
  }
};

/**
 * Main function
 */
async function main() {
  console.log(`Fetching historical data from ${provider.toUpperCase()} API for token ${token}`);
  console.log(`Interval: ${interval}, From: ${fromDate}, To: ${toDate}`);
  
  try {
    // Authenticate with API
    const authToken = await authenticate();
    console.log('Authentication successful');
    
    // Fetch historical data
    const historicalData = await fetchHistoricalData(authToken, token, interval, fromDate, toDate);
    
    // Display data summary
    console.log(`\nFetched ${historicalData.length} historical data points`);
    
    if (historicalData.length > 0) {
      // Display first and last data points
      console.log('\nFirst data point:');
      console.log(historicalData[0]);
      
      console.log('\nLast data point:');
      console.log(historicalData[historicalData.length - 1]);
      
      // Calculate statistics
      const closes = historicalData.map(candle => candle.close);
      const min = Math.min(...closes);
      const max = Math.max(...closes);
      const avg = closes.reduce((sum, close) => sum + close, 0) / closes.length;
      
      console.log(`\nStatistics:`);
      console.log(`- Minimum close: ${min.toFixed(2)}`);
      console.log(`- Maximum close: ${max.toFixed(2)}`);
      console.log(`- Average close: ${avg.toFixed(2)}`);
      console.log(`- Price range: ${(max - min).toFixed(2)}`);
      
      // Ask if user wants to save the data
      rl.question('\nDo you want to save this data to a file? (y/n): ', answer => {
        if (answer.toLowerCase() === 'y') {
          const filename = `historical_data_${token}_${interval}_${fromDate}_to_${toDate}.json`;
          fs.writeFileSync(filename, JSON.stringify(historicalData, null, 2));
          console.log(`Data saved to ${filename}`);
        }
        
        rl.close();
      });
    } else {
      console.log('No historical data received. Check your API credentials, token, and date range.');
      rl.close();
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    rl.close();
  }
}

/**
 * Authenticate with the API
 */
async function authenticate() {
  if (provider === 'kotak') {
    return authenticateKotak();
  } else if (provider === 'dhan') {
    return authenticateDhan();
  } else {
    throw new Error(`Invalid provider: ${provider}`);
  }
}

/**
 * Authenticate with Kotak API
 */
async function authenticateKotak() {
  try {
    // Step 1: Get session token
    const sessionResponse = await axios.post(`${config.kotak.apiUrl}/session/1.0/session/login/userid`, {
      userid: config.kotak.userId,
      password: config.kotak.password
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (!sessionResponse.data.success) {
      throw new Error(`Kotak API session login failed: ${sessionResponse.data.message}`);
    }
    
    const sessionToken = sessionResponse.data.data.session_token;
    
    // Step 2: Generate access token
    const accessResponse = await axios.post(`${config.kotak.apiUrl}/session/1.0/session/2fa/totp`, {
      userid: config.kotak.userId,
      accessCode: config.kotak.totpCode
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      }
    });
    
    if (!accessResponse.data.success) {
      throw new Error(`Kotak API 2FA failed: ${accessResponse.data.message}`);
    }
    
    return accessResponse.data.data.access_token;
  } catch (error) {
    throw new Error(`Kotak authentication failed: ${error.message}`);
  }
}

/**
 * Authenticate with Dhan API
 */
async function authenticateDhan() {
  try {
    // Step 1: Login with client credentials
    const loginResponse = await axios.post(`${config.dhan.apiUrl}/auth/login`, {
      client_id: config.dhan.clientId,
      client_secret: config.dhan.clientSecret
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!loginResponse.data.success) {
      throw new Error(`Dhan API login failed: ${loginResponse.data.message}`);
    }
    
    // Step 2: Generate session token
    const sessionResponse = await axios.post(`${config.dhan.apiUrl}/auth/token`, {
      request_token: loginResponse.data.data.request_token,
      client_id: config.dhan.clientId
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!sessionResponse.data.success) {
      throw new Error(`Dhan API token generation failed: ${sessionResponse.data.message}`);
    }
    
    return sessionResponse.data.data.access_token;
  } catch (error) {
    throw new Error(`Dhan authentication failed: ${error.message}`);
  }
}

/**
 * Fetch historical data
 */
async function fetchHistoricalData(authToken, token, interval, fromDate, toDate) {
  if (provider === 'kotak') {
    return fetchHistoricalDataKotak(authToken, token, interval, fromDate, toDate);
  } else if (provider === 'dhan') {
    return fetchHistoricalDataDhan(authToken, token, interval, fromDate, toDate);
  } else {
    throw new Error(`Invalid provider: ${provider}`);
  }
}

/**
 * Fetch historical data from Kotak API
 */
async function fetchHistoricalDataKotak(authToken, token, interval, fromDate, toDate) {
  try {
    // Map interval to Kotak API format
    const intervalMap = {
      minute: '1',
      hour: '60',
      day: 'D'
    };
    
    const kotakInterval = intervalMap[interval] || 'D';
    
    // Format dates for Kotak API
    const from = new Date(fromDate).getTime();
    const to = new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1; // End of the day
    
    const response = await axios.get(`${config.kotak.apiUrl}/market/1.0/historical`, {
      params: {
        token,
        interval: kotakInterval,
        from,
        to
      },
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.data.success) {
      throw new Error(`Failed to get historical data: ${response.data.message}`);
    }
    
    // Transform data to standard format
    return response.data.data.map(candle => ({
      timestamp: new Date(candle.timestamp).toISOString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume
    }));
  } catch (error) {
    throw new Error(`Error fetching historical data from Kotak API: ${error.message}`);
  }
}

/**
 * Fetch historical data from Dhan API
 */
async function fetchHistoricalDataDhan(authToken, token, interval, fromDate, toDate) {
  try {
    // Map interval to Dhan API format
    const intervalMap = {
      minute: '1m',
      hour: '1h',
      day: '1d'
    };
    
    const dhanInterval = intervalMap[interval] || '1d';
    
    const response = await axios.get(`${config.dhan.apiUrl}/charts/history`, {
      params: {
        token,
        resolution: dhanInterval,
        from: Math.floor(new Date(fromDate).getTime() / 1000),
        to: Math.floor(new Date(toDate).getTime() / 1000) + 24 * 60 * 60 - 1 // End of the day
      },
      headers: {
        'X-Access-Token': authToken,
        'X-Client-Id': config.dhan.clientId,
        'Accept': 'application/json'
      }
    });
    
    if (!response.data.success) {
      throw new Error(`Failed to get historical data: ${response.data.message}`);
    }
    
    // Transform data to standard format
    const { t, o, h, l, c, v } = response.data.data;
    
    return t.map((timestamp, index) => ({
      timestamp: new Date(timestamp * 1000).toISOString(),
      open: o[index],
      high: h[index],
      low: l[index],
      close: c[index],
      volume: v[index]
    }));
  } catch (error) {
    throw new Error(`Error fetching historical data from Dhan API: ${error.message}`);
  }
}

// Run the main function
main().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
