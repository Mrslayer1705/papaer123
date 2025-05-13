/**
 * Script to fetch real-time market data from Kotak/Dhan API
 * 
 * This script demonstrates how to:
 * 1. Authenticate with the API
 * 2. Connect to WebSocket for real-time data
 * 3. Subscribe to market data for specific tokens
 * 4. Process and display real-time updates
 * 
 * Usage:
 * node scripts/fetch-realtime-data.js [--provider=kotak|dhan] [--token=43854] [--duration=60]
 */

require('dotenv').config();
const WebSocket = require('ws');
const axios = require('axios');
const readline = require('readline');

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value;
  return acc;
}, {});

// Configuration
const provider = args.provider || process.env.MARKET_DATA_PROVIDER || 'kotak';
const token = args.token || '43854'; // Default to NIFTY 24000 CE
const duration = parseInt(args.duration || '60', 10); // Default to 60 seconds

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// API configuration
const config = {
  kotak: {
    apiUrl: process.env.KOTAK_API_URL || 'https://tradeapi.kotaksecurities.com/apim',
    wsUrl: process.env.KOTAK_WS_URL || 'wss://websocket.kotaksecurities.com/feed',
    userId: process.env.KOTAK_USER_ID,
    password: process.env.KOTAK_PASSWORD,
    totpCode: process.env.KOTAK_TOTP_CODE
  },
  dhan: {
    apiUrl: process.env.DHAN_API_URL || 'https://api.dhan.co',
    wsUrl: process.env.DHAN_WS_URL || 'wss://stream.dhan.co',
    clientId: process.env.DHAN_CLIENT_ID,
    clientSecret: process.env.DHAN_CLIENT_SECRET
  }
};

// Store for price updates
const priceUpdates = [];

/**
 * Main function
 */
async function main() {
  console.log(`Fetching real-time data from ${provider.toUpperCase()} API for token ${token}`);
  
  try {
    // Authenticate with API
    const authToken = await authenticate();
    console.log('Authentication successful');
    
    // Connect to WebSocket
    const ws = await connectWebSocket(authToken);
    
    // Subscribe to market data
    subscribeToMarketData(ws, token);
    
    // Set up timer to end the script after specified duration
    setTimeout(() => {
      console.log(`\nFetched ${priceUpdates.length} price updates in ${duration} seconds`);
      
      if (priceUpdates.length > 0) {
        // Calculate statistics
        const prices = priceUpdates.map(update => update.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        
        console.log(`\nStatistics:`);
        console.log(`- Minimum price: ${min.toFixed(2)}`);
        console.log(`- Maximum price: ${max.toFixed(2)}`);
        console.log(`- Average price: ${avg.toFixed(2)}`);
        console.log(`- Price range: ${(max - min).toFixed(2)}`);
        
        // Ask if user wants to save the data
        rl.question('\nDo you want to save this data to a file? (y/n): ', answer => {
          if (answer.toLowerCase() === 'y') {
            const filename = `price_data_${token}_${new Date().toISOString().replace(/:/g, '-')}.json`;
            const fs = require('fs');
            fs.writeFileSync(filename, JSON.stringify(priceUpdates, null, 2));
            console.log(`Data saved to ${filename}`);
          }
          
          // Close WebSocket and exit
          ws.close();
          rl.close();
          process.exit(0);
        });
      } else {
        console.log('No price updates received. Check your API credentials and token.');
        ws.close();
        rl.close();
        process.exit(1);
      }
    }, duration * 1000);
    
  } catch (error) {
    console.error('Error:', error.message);
    rl.close();
    process.exit(1);
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
 * Connect to WebSocket
 */
async function connectWebSocket(authToken) {
  return new Promise((resolve, reject) => {
    try {
      // Determine WebSocket URL and headers
      const wsUrl = provider === 'kotak' ? config.kotak.wsUrl : config.dhan.wsUrl;
      const headers = {};
      
      if (provider === 'kotak') {
        headers.Authorization = `Bearer ${authToken}`;
      } else if (provider === 'dhan') {
        headers['X-Access-Token'] = authToken;
        headers['X-Client-Id'] = config.dhan.clientId;
      }
      
      // Create WebSocket connection
      const ws = new WebSocket(wsUrl, { headers });
      
      // Set up event handlers
      ws.on('open', () => {
        console.log('WebSocket connected');
        resolve(ws);
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          processWebSocketMessage(message);
        } catch (error) {
          console.error('Error processing WebSocket message:', error.message);
        }
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error.message);
      });
      
      ws.on('close', () => {
        console.log('WebSocket disconnected');
      });
      
      // Set timeout for connection
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);
      
      // Clear timeout on successful connection
      ws.once('open', () => {
        clearTimeout(timeout);
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Subscribe to market data
 */
function subscribeToMarketData(ws, token) {
  if (provider === 'kotak') {
    // Format subscription message for Kotak API
    const subscriptionMessage = {
      type: 'subscribe',
      data: {
        mode: 'full', // 'full' for both tick and depth, 'quote' for tick only
        tokens: [token]
      }
    };
    
    // Send subscription request
    ws.send(JSON.stringify(subscriptionMessage));
  } else if (provider === 'dhan') {
    // Format subscription message for Dhan API
    const subscriptionMessage = {
      action: 'subscribe',
      params: {
        mode: 'full',
        tokens: [token]
      }
    };
    
    // Send subscription request
    ws.send(JSON.stringify(subscriptionMessage));
  }
  
  console.log(`Subscribed to market data for token: ${token}`);
}

/**
 * Process WebSocket message
 */
function processWebSocketMessage(message) {
  if (provider === 'kotak') {
    processKotakMessage(message);
  } else if (provider === 'dhan') {
    processDhanMessage(message);
  }
}

/**
 * Process Kotak WebSocket message
 */
function processKotakMessage(message) {
  switch (message.type) {
    case 'ack':
      console.log('Subscription acknowledged:', message.data);
      break;
      
    case 'tick':
      // Process tick data
      const { token: tickToken, ltp, ltq, ltt, vol, oi } = message.data;
      
      if (tickToken === token && ltp) {
        const timestamp = new Date().toISOString();
        const update = { timestamp, token: tickToken, price: ltp, quantity: ltq, time: ltt, volume: vol, openInterest: oi };
        
        priceUpdates.push(update);
        console.log(`[${timestamp}] Price update: ${ltp.toFixed(2)}`);
      }
      break;
      
    case 'depth':
      // Process market depth data (optional)
      console.log('Market depth update received');
      break;
      
    case 'error':
      console.error('Kotak WebSocket error:', message.data);
      break;
      
    default:
      console.log('Unknown message type:', message.type);
  }
}

/**
 * Process Dhan WebSocket message
 */
function processDhanMessage(message) {
  switch (message.type) {
    case 'success':
      console.log('Subscription successful:', message.data);
      break;
      
    case 'quote':
      // Process quote data
      const { token: quoteToken, lastPrice, lastQuantity, lastTradeTime, volume, openInterest } = message.data;
      
      if (quoteToken === token && lastPrice) {
        const timestamp = new Date().toISOString();
        const update = { timestamp, token: quoteToken, price: lastPrice, quantity: lastQuantity, time: lastTradeTime, volume, openInterest };
        
        priceUpdates.push(update);
        console.log(`[${timestamp}] Price update: ${lastPrice.toFixed(2)}`);
      }
      break;
      
    case 'error':
      console.error('Dhan WebSocket error:', message.data);
      break;
      
    default:
      console.log('Unknown message type:', message.type);
  }
}

// Run the main function
main().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
