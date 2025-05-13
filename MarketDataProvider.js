/**
 * Market Data Provider Service
 *
 * This service is responsible for:
 * 1. Connecting to Kotak/Dhan API for market data
 * 2. Subscribing to market data feeds
 * 3. Providing real-time updates for paper order prices
 */

const WebSocket = require('ws');
const axios = require('axios');
const PaperOrder = require('../models/PaperOrder');

class MarketDataProvider {
  constructor(io) {
    this.io = io;
    this.ws = null;
    this.isConnected = false;
    this.subscriptions = new Map(); // Map of token -> callback
    this.latestPrices = new Map(); // Cache of token -> latest price
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 5000; // 5 seconds
    this.heartbeatInterval = null;
    this.tokenExpiryTime = null;
    this.sessionToken = null;
    this.authToken = null;

    // Fallback to mock data if API is not available
    this.useMockData = process.env.USE_MOCK_DATA === 'true';
    this.mockDataIntervals = new Map();
  }

  /**
   * Initialize the market data provider
   */
  async initialize() {
    try {
      console.log('Initializing market data provider...');

      if (process.env.USE_MOCK_DATA === 'true') {
        console.log('Using mock market data provider');
        this.useMockData = true;
        return;
      }

      // Try to authenticate with Kotak API
      await this.authenticate();

      // Connect to WebSocket
      await this.connectWebSocket();

      // Start heartbeat
      this.startHeartbeat();

      console.log('Market data provider initialized successfully');
    } catch (error) {
      console.error('Failed to initialize market data provider:', error.message);
      console.log('Falling back to mock data');
      this.useMockData = true;
    }
  }

  /**
   * Authenticate with the market data API
   */
  async authenticate() {
    try {
      const provider = process.env.MARKET_DATA_PROVIDER;
      console.log(`Authenticating with ${provider} API...`);

      // For Kotak API
      if (provider === 'kotak') {
        // Step 1: Get session token
        const sessionResponse = await axios.post(`${process.env.KOTAK_API_URL}/session/1.0/session/login/userid`, {
          userid: process.env.KOTAK_USER_ID,
          password: process.env.KOTAK_PASSWORD
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        if (!sessionResponse.data.success) {
          throw new Error(`Kotak API session login failed: ${sessionResponse.data.message}`);
        }

        this.sessionToken = sessionResponse.data.data.session_token;
        console.log('Session token obtained');

        // Step 2: Generate access token
        const accessResponse = await axios.post(`${process.env.KOTAK_API_URL}/session/1.0/session/2fa/totp`, {
          userid: process.env.KOTAK_USER_ID,
          accessCode: process.env.KOTAK_TOTP_CODE // Use environment variable for TOTP
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${this.sessionToken}`
          }
        });

        if (!accessResponse.data.success) {
          throw new Error(`Kotak API 2FA failed: ${accessResponse.data.message}`);
        }

        this.authToken = accessResponse.data.data.access_token;
        this.tokenExpiryTime = Date.now() + (8 * 60 * 60 * 1000); // Token expires in 8 hours

        console.log('Successfully authenticated with Kotak API');
      }
      // For Dhan API
      else if (provider === 'dhan') {
        // Step 1: Login with client credentials
        const loginResponse = await axios.post(`${process.env.DHAN_API_URL}/auth/login`, {
          client_id: process.env.DHAN_CLIENT_ID,
          client_secret: process.env.DHAN_CLIENT_SECRET
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!loginResponse.data.success) {
          throw new Error(`Dhan API login failed: ${loginResponse.data.message}`);
        }

        // Step 2: Generate session token
        const sessionResponse = await axios.post(`${process.env.DHAN_API_URL}/auth/token`, {
          request_token: loginResponse.data.data.request_token,
          client_id: process.env.DHAN_CLIENT_ID
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!sessionResponse.data.success) {
          throw new Error(`Dhan API token generation failed: ${sessionResponse.data.message}`);
        }

        this.authToken = sessionResponse.data.data.access_token;
        this.tokenExpiryTime = Date.now() + (24 * 60 * 60 * 1000); // Token expires in 24 hours

        console.log('Successfully authenticated with Dhan API');
      }
      else {
        throw new Error(`Invalid market data provider: ${provider}`);
      }

      return this.authToken;
    } catch (error) {
      console.error('Authentication failed:', error.message);
      throw error;
    }
  }

  /**
   * Connect to the WebSocket for market data
   */
  async connectWebSocket() {
    try {
      const provider = process.env.MARKET_DATA_PROVIDER;
      console.log(`Connecting to ${provider} WebSocket...`);

      // Determine WebSocket URL based on provider
      const wsUrl = provider === 'kotak'
        ? process.env.KOTAK_WS_URL
        : process.env.DHAN_WS_URL;

      // Create WebSocket connection with appropriate headers
      const headers = {};

      if (provider === 'kotak') {
        headers.Authorization = `Bearer ${this.authToken}`;
      } else if (provider === 'dhan') {
        headers['X-Access-Token'] = this.authToken;
        headers['X-Client-Id'] = process.env.DHAN_CLIENT_ID;
      }

      this.ws = new WebSocket(wsUrl, { headers });

      // Set up event handlers
      this.ws.on('open', this.handleOpen.bind(this));
      this.ws.on('message', this.handleMessage.bind(this));
      this.ws.on('error', this.handleError.bind(this));
      this.ws.on('close', this.handleClose.bind(this));

      // Return a promise that resolves when the connection is established
      return new Promise((resolve, reject) => {
        // Set timeout for connection
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        // Handle successful connection
        this.ws.once('open', () => {
          clearTimeout(timeout);
          resolve();
        });

        // Handle connection error
        this.ws.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      console.error('WebSocket connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Handle WebSocket open event
   */
  handleOpen() {
    const provider = process.env.MARKET_DATA_PROVIDER;
    console.log(`${provider} WebSocket connected`);
    this.isConnected = true;
    this.reconnectAttempts = 0;

    // Subscribe to market indices for general market data
    this.subscribeToMarketIndices();

    // Resubscribe to all tokens
    for (const token of this.subscriptions.keys()) {
      this.subscribeToMarketData(token);
    }
  }

  /**
   * Handle WebSocket message event
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      const provider = process.env.MARKET_DATA_PROVIDER;

      if (provider === 'kotak') {
        this.handleKotakMessage(message);
      } else if (provider === 'dhan') {
        this.handleDhanMessage(message);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error.message);
    }
  }

  /**
   * Handle Kotak WebSocket message
   */
  handleKotakMessage(message) {
    // Process different message types
    switch (message.type) {
      case 'ack':
        // Acknowledgment message
        console.log('Subscription acknowledged:', message.data);
        break;

      case 'tick':
        // Price tick data
        this.processKotakTickData(message.data);
        break;

      case 'depth':
        // Market depth data
        this.processKotakDepthData(message.data);
        break;

      case 'error':
        // Error message
        console.error('Kotak WebSocket error:', message.data);
        break;

      default:
        console.log('Unknown Kotak message type:', message.type);
    }
  }

  /**
   * Handle Dhan WebSocket message
   */
  handleDhanMessage(message) {
    // Process different message types
    switch (message.type) {
      case 'success':
        // Subscription success message
        console.log('Dhan subscription successful:', message.data);
        break;

      case 'quote':
        // Quote update
        this.processDhanQuoteData(message.data);
        break;

      case 'order_update':
        // Order update (not used in paper trading)
        console.log('Dhan order update received');
        break;

      case 'error':
        // Error message
        console.error('Dhan WebSocket error:', message.data);
        break;

      default:
        console.log('Unknown Dhan message type:', message.type);
    }
  }

  /**
   * Process tick data from Kotak API
   */
  processKotakTickData(data) {
    // Extract relevant fields
    const { token, ltp, ltq, ltt, vol, oi } = data;

    if (!token || !ltp) return;

    // Check if we have a subscription for this token
    if (this.subscriptions.has(token)) {
      const callback = this.subscriptions.get(token);

      // Call the callback with the LTP
      callback(ltp);

      // Emit market update event
      this.io.emit(`market-update:${token}`, {
        token,
        ltp,
        ltq,  // Last traded quantity
        ltt,  // Last traded time
        vol,  // Volume
        oi    // Open interest
      });

      // Store the latest price
      this.latestPrices = this.latestPrices || new Map();
      this.latestPrices.set(token, ltp);
    }
  }

  /**
   * Process quote data from Dhan API
   */
  processDhanQuoteData(data) {
    // Extract relevant fields
    const { token, lastPrice, lastQuantity, lastTradeTime, volume, openInterest } = data;

    if (!token || !lastPrice) return;

    // Check if we have a subscription for this token
    if (this.subscriptions.has(token)) {
      const callback = this.subscriptions.get(token);

      // Call the callback with the last price
      callback(lastPrice);

      // Emit market update event
      this.io.emit(`market-update:${token}`, {
        token,
        ltp: lastPrice,
        ltq: lastQuantity,
        ltt: lastTradeTime,
        vol: volume,
        oi: openInterest
      });

      // Store the latest price
      this.latestPrices = this.latestPrices || new Map();
      this.latestPrices.set(token, lastPrice);
    }
  }

  /**
   * Process market depth data from Kotak API
   */
  processKotakDepthData(data) {
    const { token, bids, asks } = data;

    if (!token || !bids || !asks) return;

    // Emit market depth update event
    this.io.emit(`depth-update:${token}`, {
      token,
      bids,
      asks
    });
  }

  /**
   * Process market depth data from Dhan API
   */
  processDhanDepthData(data) {
    const { token, buyDepth, sellDepth } = data;

    if (!token || !buyDepth || !sellDepth) return;

    // Emit market depth update event
    this.io.emit(`depth-update:${token}`, {
      token,
      bids: buyDepth,
      asks: sellDepth
    });
  }

  /**
   * Process market data from Dhan API
   */
  processDhanMarketData(message) {
    if (message.type === 'quote' && message.data) {
      const { token, lastPrice } = message.data;

      if (token && lastPrice && this.subscriptions.has(token)) {
        const callback = this.subscriptions.get(token);
        callback(lastPrice);

        // Emit market update
        this.io.emit(`market-update:${token}`, {
          token,
          ltp: lastPrice
        });
      }
    }
  }

  /**
   * Handle WebSocket error event
   */
  handleError(error) {
    console.error('Kotak WebSocket error:', error.message);

    // Emit error event
    this.io.emit('market-data-error', {
      message: 'WebSocket connection error',
      error: error.message
    });
  }

  /**
   * Handle WebSocket close event
   */
  handleClose(code, reason) {
    console.log(`Kotak WebSocket disconnected: ${code} - ${reason}`);
    this.isConnected = false;

    // Stop heartbeat
    this.stopHeartbeat();

    // Emit disconnection event
    this.io.emit('market-data-disconnected');

    // Attempt to reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

      setTimeout(() => {
        this.reconnect().catch(error => {
          console.error('Reconnection failed:', error.message);
        });
      }, this.reconnectInterval);
    } else {
      console.log('Max reconnect attempts reached. Falling back to mock data.');
      this.useMockData = true;

      // Restart all subscriptions with mock data
      for (const [token, callback] of this.subscriptions.entries()) {
        this.subscribeToMockData(token, callback);
      }
    }
  }

  /**
   * Reconnect to Kotak WebSocket
   */
  async reconnect() {
    try {
      console.log('Reconnecting to Kotak WebSocket...');

      // Close existing connection if any
      if (this.ws) {
        this.ws.terminate();
        this.ws = null;
      }

      // Re-authenticate if token might be expired
      if (this.tokenExpiryTime && Date.now() > this.tokenExpiryTime) {
        await this.authenticate();
      }

      // Connect to WebSocket
      await this.connectWebSocket();

      // Start heartbeat
      this.startHeartbeat();

      console.log('Reconnected to Kotak WebSocket successfully');
      return true;
    } catch (error) {
      console.error('Reconnection failed:', error.message);
      return false;
    }
  }

  /**
   * Start heartbeat to keep WebSocket connection alive
   */
  startHeartbeat() {
    // Clear any existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Subscribe to market data for a token
   */
  subscribe(token, callback) {
    // Store the callback
    this.subscriptions.set(token, callback);

    if (this.useMockData) {
      return this.subscribeToMockData(token, callback);
    } else if (this.isConnected) {
      return this.subscribeToMarketData(token);
    }

    // If not connected, the subscription will be processed when connection is established
    return null;
  }

  /**
   * Subscribe to market data via WebSocket
   */
  subscribeToMarketData(token) {
    if (!this.isConnected) {
      console.log(`WebSocket not connected. Will subscribe to ${token} when connected.`);
      return;
    }

    console.log(`Subscribing to market data for token: ${token}`);

    const provider = process.env.MARKET_DATA_PROVIDER;

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
      this.ws.send(JSON.stringify(subscriptionMessage));
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
      this.ws.send(JSON.stringify(subscriptionMessage));
    }
  }

  /**
   * Subscribe to market indices for general market data
   */
  subscribeToMarketIndices() {
    if (!this.isConnected) return;

    // Common market indices
    const indices = [
      '26000', // NIFTY 50
      '26009', // BANK NIFTY
      '26017', // NIFTY MIDCAP 50
      '26025'  // INDIA VIX
    ];

    console.log('Subscribing to market indices');

    const provider = process.env.MARKET_DATA_PROVIDER;

    if (provider === 'kotak') {
      // Format subscription message for Kotak API
      const subscriptionMessage = {
        type: 'subscribe',
        data: {
          mode: 'quote',
          tokens: indices
        }
      };

      // Send subscription request
      this.ws.send(JSON.stringify(subscriptionMessage));
    } else if (provider === 'dhan') {
      // Format subscription message for Dhan API
      const subscriptionMessage = {
        action: 'subscribe',
        params: {
          mode: 'quote',
          tokens: indices
        }
      };

      // Send subscription request
      this.ws.send(JSON.stringify(subscriptionMessage));
    }
  }

  /**
   * Subscribe to mock market data
   */
  subscribeToMockData(token, callback) {
    // Generate initial price
    const initialPrice = this.generateRandomPrice();

    // Call callback with initial price
    callback(initialPrice);

    // Emit initial market update
    this.io.emit(`market-update:${token}`, {
      token,
      ltp: initialPrice
    });

    // Set up interval for price updates
    const interval = setInterval(() => {
      // Get current price
      const currentPrice = this.mockDataIntervals.get(token).price;

      // Generate new price with small random change
      const priceChange = currentPrice * (Math.random() * 0.01 - 0.005);
      const newPrice = Math.max(0.05, currentPrice + priceChange);

      // Update stored price
      this.mockDataIntervals.get(token).price = newPrice;

      // Call callback with new price
      callback(newPrice);

      // Emit market update
      this.io.emit(`market-update:${token}`, {
        token,
        ltp: newPrice
      });
    }, 5000); // Update every 5 seconds

    // Store interval and initial price
    this.mockDataIntervals.set(token, {
      interval,
      price: initialPrice
    });

    return initialPrice;
  }

  /**
   * Unsubscribe from market data for a token
   */
  unsubscribe(token) {
    if (this.useMockData) {
      // Clear mock data interval
      if (this.mockDataIntervals.has(token)) {
        clearInterval(this.mockDataIntervals.get(token).interval);
        this.mockDataIntervals.delete(token);
      }
    } else if (this.isConnected) {
      console.log(`Unsubscribing from market data for token: ${token}`);

      const provider = process.env.MARKET_DATA_PROVIDER;

      if (provider === 'kotak') {
        // Format unsubscription message for Kotak API
        const unsubscriptionMessage = {
          type: 'unsubscribe',
          data: {
            tokens: [token]
          }
        };

        // Send unsubscription request
        this.ws.send(JSON.stringify(unsubscriptionMessage));
      } else if (provider === 'dhan') {
        // Format unsubscription message for Dhan API
        const unsubscriptionMessage = {
          action: 'unsubscribe',
          params: {
            tokens: [token]
          }
        };

        // Send unsubscription request
        this.ws.send(JSON.stringify(unsubscriptionMessage));
      }
    }

    // Remove from subscriptions
    this.subscriptions.delete(token);

    // Remove from latest prices cache
    if (this.latestPrices && this.latestPrices.has(token)) {
      this.latestPrices.delete(token);
    }

    console.log(`Unsubscribed from market data for token: ${token}`);
  }

  /**
   * Generate a random price for mock data
   */
  generateRandomPrice() {
    return parseFloat((Math.random() * 1000 + 100).toFixed(2));
  }

  /**
   * Get current LTP for a token
   */
  async getCurrentLTP(token, initialPrice = null) {
    // If we already have the price in cache, return it
    if (this.latestPrices && this.latestPrices.has(token)) {
      return this.latestPrices.get(token);
    }

    if (this.useMockData) {
      // If we already have mock data for this token, return it
      if (this.mockDataIntervals.has(token)) {
        return this.mockDataIntervals.get(token).price;
      }

      // Otherwise, create a new subscription with mock data
      return new Promise((resolve) => {
        const price = this.subscribeToMockData(token, () => {
          // This callback will be called with future updates
        });
        resolve(price);
      });
    } else {
      const provider = process.env.MARKET_DATA_PROVIDER;

      try {
        console.log(`Fetching quote for token: ${token} from ${provider} API`);

        let ltp;

        if (provider === 'kotak') {
          // Get real-time quote from Kotak API
          const response = await axios.get(`${process.env.KOTAK_API_URL}/market/1.0/quote`, {
            params: {
              token
            },
            headers: {
              'Authorization': `Bearer ${this.authToken}`,
              'Accept': 'application/json'
            }
          });

          if (!response.data.success) {
            throw new Error(`Failed to get quote: ${response.data.message}`);
          }

          ltp = response.data.data.ltp;
        } else if (provider === 'dhan') {
          // Get real-time quote from Dhan API
          const response = await axios.get(`${process.env.DHAN_API_URL}/quotes`, {
            params: {
              token
            },
            headers: {
              'X-Access-Token': this.authToken,
              'X-Client-Id': process.env.DHAN_CLIENT_ID,
              'Accept': 'application/json'
            }
          });

          if (!response.data.success) {
            throw new Error(`Failed to get quote: ${response.data.message}`);
          }

          ltp = response.data.data.lastPrice;
        } else {
          throw new Error(`Invalid market data provider: ${provider}`);
        }

        // Cache the price
        this.latestPrices = this.latestPrices || new Map();
        this.latestPrices.set(token, ltp);

        return ltp;
      } catch (error) {
        console.error('Error fetching quote:', error.message);

        // Fall back to initial price or mock data
        if (initialPrice) return initialPrice;
        return this.generateRandomPrice();
      }
    }
  }

  /**
   * Resolve symbol to token
   */
  async resolveSymbolToToken(symbol, strike, optionType, expiry) {
    try {
      console.log(`Resolving symbol: ${symbol} ${strike} ${optionType} ${expiry}`);

      const provider = process.env.MARKET_DATA_PROVIDER;

      if (provider === 'kotak') {
        return this.resolveSymbolToTokenKotak(symbol, strike, optionType, expiry);
      } else if (provider === 'dhan') {
        return this.resolveSymbolToTokenDhan(symbol, strike, optionType, expiry);
      } else {
        throw new Error(`Invalid market data provider: ${provider}`);
      }
    } catch (error) {
      console.error('Error resolving symbol to token:', error.message);
      throw error;
    }
  }

  /**
   * Resolve symbol to token using Kotak API
   */
  async resolveSymbolToTokenKotak(symbol, strike, optionType, expiry) {
    try {
      // Format the search query
      const searchQuery = `${symbol} ${strike} ${optionType}`;

      const response = await axios.get(`${process.env.KOTAK_API_URL}/market/1.0/search`, {
        params: {
          search: searchQuery,
          exchange: 'nse_fo'
        },
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.data.success || !response.data.data || response.data.data.length === 0) {
        throw new Error(`No results found for ${searchQuery}`);
      }

      // Find the matching contract
      const contracts = response.data.data;
      const expiryDate = new Date(expiry);

      for (const contract of contracts) {
        const contractExpiry = new Date(contract.expiry);

        if (
          contract.symbol === symbol &&
          contract.strike === parseFloat(strike) &&
          contract.option_type === optionType &&
          contractExpiry.getTime() === expiryDate.getTime()
        ) {
          console.log(`Found token ${contract.token} for ${searchQuery}`);
          return contract.token;
        }
      }

      throw new Error(`No matching contract found for ${searchQuery} with expiry ${expiry}`);
    } catch (error) {
      console.error('Error resolving symbol to token with Kotak API:', error.message);
      throw error;
    }
  }

  /**
   * Resolve symbol to token using Dhan API
   */
  async resolveSymbolToTokenDhan(symbol, strike, optionType, expiry) {
    try {
      // Format the search query
      const searchQuery = `${symbol} ${strike} ${optionType}`;

      const response = await axios.get(`${process.env.DHAN_API_URL}/contracts/search`, {
        params: {
          query: searchQuery,
          exchange: 'NFO'
        },
        headers: {
          'X-Access-Token': this.authToken,
          'X-Client-Id': process.env.DHAN_CLIENT_ID,
          'Accept': 'application/json'
        }
      });

      if (!response.data.success || !response.data.data || response.data.data.length === 0) {
        throw new Error(`No results found for ${searchQuery}`);
      }

      // Find the matching contract
      const contracts = response.data.data;
      const expiryDate = new Date(expiry);

      for (const contract of contracts) {
        const contractExpiry = new Date(contract.expiry);

        if (
          contract.tradingSymbol.includes(symbol) &&
          contract.strikePrice === parseFloat(strike) &&
          contract.optionType === optionType &&
          contractExpiry.getTime() === expiryDate.getTime()
        ) {
          console.log(`Found token ${contract.token} for ${searchQuery}`);
          return contract.token;
        }
      }

      throw new Error(`No matching contract found for ${searchQuery} with expiry ${expiry}`);
    } catch (error) {
      console.error('Error resolving symbol to token with Dhan API:', error.message);
      throw error;
    }
  }
}

module.exports = MarketDataProvider;
