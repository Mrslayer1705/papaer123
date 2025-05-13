/**
 * Script to search for contracts using Kotak/Dhan API
 *
 * This script demonstrates how to:
 * 1. Authenticate with the API
 * 2. Search for contracts based on symbol, strike, option type, etc.
 * 3. Display the search results
 *
 * Usage:
 * node scripts/search-contracts.js [--provider=kotak|dhan] [--query="NIFTY 24000 CE"]
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
const query = args.query || 'NIFTY 24000 CE';

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
  console.log(`Searching for contracts with ${provider.toUpperCase()} API`);
  console.log(`Query: "${query}"`);

  try {
    // Authenticate with API
    const authToken = await authenticate();
    console.log('Authentication successful');

    // Search for contracts
    const contracts = await searchContracts(authToken, query);

    // Display search results
    console.log(`\nFound ${contracts.length} contracts matching "${query}"`);

    if (contracts.length > 0) {
      // Display contracts in a table format
      console.log('\nContract Details:');
      console.log('--------------------------------------------------------------------------------');
      console.log('Token    | Symbol                | Strike  | Option | Expiry       | Exchange');
      console.log('--------------------------------------------------------------------------------');

      contracts.forEach(contract => {
        const token = contract.token.toString().padEnd(8);
        const symbol = contract.symbol.padEnd(21);
        const strike = contract.strike.toString().padEnd(8);
        const optionType = contract.optionType.padEnd(7);
        const expiry = contract.expiry.padEnd(13);
        const exchange = contract.exchange;

        console.log(`${token}| ${symbol}| ${strike}| ${optionType}| ${expiry}| ${exchange}`);
      });

      console.log('--------------------------------------------------------------------------------');

      // Ask if user wants to save the data
      rl.question('\nDo you want to save these contracts to a file? (y/n): ', answer => {
        if (answer.toLowerCase() === 'y') {
          const filename = `contracts_${query.replace(/\s+/g, '_')}.json`;
          fs.writeFileSync(filename, JSON.stringify(contracts, null, 2));
          console.log(`Contracts saved to ${filename}`);
        }

        // Ask if user wants to get token for a specific contract
        if (contracts.length > 1) {
          rl.question('\nEnter the index of the contract to get its token (0 to exit): ', index => {
            const idx = parseInt(index, 10);
            if (idx >= 0 && idx < contracts.length) {
              console.log(`\nToken for selected contract: ${contracts[idx].token}`);
              console.log('Use this token with the fetch-realtime-data.js script to get real-time updates.');
            }
            rl.close();
          });
        } else {
          rl.close();
        }
      });
    } else {
      console.log('No contracts found. Try a different search query.');
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
  // Check if we're using mock data
  if (process.env.USE_MOCK_DATA === 'true') {
    console.log('Using mock authentication');
    return 'mock-auth-token';
  }

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
 * Search for contracts
 */
async function searchContracts(authToken, query) {
  if (provider === 'kotak') {
    return searchContractsKotak(authToken, query);
  } else if (provider === 'dhan') {
    return searchContractsDhan(authToken, query);
  } else {
    throw new Error(`Invalid provider: ${provider}`);
  }
}

/**
 * Search for contracts using Kotak API
 */
async function searchContractsKotak(authToken, query) {
  try {
    // Check if we're using mock data
    if (process.env.USE_MOCK_DATA === 'true') {
      console.log('Using mock data for contract search');

      // Parse the query to extract symbol, strike, and option type
      const parts = query.split(' ');
      const symbol = parts[0];
      const strike = parts.length > 1 ? parseFloat(parts[1]) : 0;
      const optionType = parts.length > 2 ? parts[2] : '';

      // Generate mock contracts
      const mockContracts = [];

      // Current date
      const now = new Date();

      // Generate contracts for the next 3 monthly expiries
      for (let i = 0; i < 3; i++) {
        const expiry = new Date(now);
        expiry.setMonth(expiry.getMonth() + i);
        expiry.setDate(expiry.getDate() + (25 - expiry.getDate())); // Around 25th of each month

        const expiryStr = expiry.toLocaleDateString();
        const tokenBase = 43000 + i * 100;

        // Add the exact match
        mockContracts.push({
          token: tokenBase + 54,
          symbol,
          strike,
          optionType,
          expiry: expiryStr,
          exchange: 'NSE_FO'
        });

        // Add some variations
        mockContracts.push({
          token: tokenBase + 55,
          symbol,
          strike: strike + 500,
          optionType,
          expiry: expiryStr,
          exchange: 'NSE_FO'
        });

        mockContracts.push({
          token: tokenBase + 56,
          symbol,
          strike: strike - 500,
          optionType,
          expiry: expiryStr,
          exchange: 'NSE_FO'
        });
      }

      return mockContracts;
    }

    // Real API call
    const response = await axios.get(`${config.kotak.apiUrl}/market/1.0/search`, {
      params: {
        search: query,
        exchange: 'nse_fo'
      },
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.data.success) {
      throw new Error(`Failed to search contracts: ${response.data.message}`);
    }

    // Transform data to standard format
    return response.data.data.map(contract => ({
      token: contract.token,
      symbol: contract.symbol,
      strike: contract.strike || 0,
      optionType: contract.option_type || 'N/A',
      expiry: contract.expiry ? new Date(contract.expiry).toLocaleDateString() : 'N/A',
      exchange: contract.exchange || 'NSE_FO'
    }));
  } catch (error) {
    throw new Error(`Error searching contracts with Kotak API: ${error.message}`);
  }
}

/**
 * Search for contracts using Dhan API
 */
async function searchContractsDhan(authToken, query) {
  try {
    // Check if we're using mock data
    if (process.env.USE_MOCK_DATA === 'true') {
      console.log('Using mock data for contract search');

      // Parse the query to extract symbol, strike, and option type
      const parts = query.split(' ');
      const symbol = parts[0];
      const strike = parts.length > 1 ? parseFloat(parts[1]) : 0;
      const optionType = parts.length > 2 ? parts[2] : '';

      // Generate mock contracts
      const mockContracts = [];

      // Current date
      const now = new Date();

      // Generate contracts for the next 3 monthly expiries
      for (let i = 0; i < 3; i++) {
        const expiry = new Date(now);
        expiry.setMonth(expiry.getMonth() + i);
        expiry.setDate(expiry.getDate() + (25 - expiry.getDate())); // Around 25th of each month

        const expiryStr = expiry.toLocaleDateString();
        const tokenBase = 43000 + i * 100;

        // Add the exact match
        mockContracts.push({
          token: tokenBase + 54,
          symbol: `${symbol}${expiry.getMonth() + 1}${expiry.getFullYear().toString().slice(-2)}`,
          strike,
          optionType,
          expiry: expiryStr,
          exchange: 'NFO'
        });

        // Add some variations
        mockContracts.push({
          token: tokenBase + 55,
          symbol: `${symbol}${expiry.getMonth() + 1}${expiry.getFullYear().toString().slice(-2)}`,
          strike: strike + 500,
          optionType,
          expiry: expiryStr,
          exchange: 'NFO'
        });

        mockContracts.push({
          token: tokenBase + 56,
          symbol: `${symbol}${expiry.getMonth() + 1}${expiry.getFullYear().toString().slice(-2)}`,
          strike: strike - 500,
          optionType,
          expiry: expiryStr,
          exchange: 'NFO'
        });
      }

      return mockContracts;
    }

    // Real API call
    const response = await axios.get(`${config.dhan.apiUrl}/contracts/search`, {
      params: {
        query,
        exchange: 'NFO'
      },
      headers: {
        'X-Access-Token': authToken,
        'X-Client-Id': config.dhan.clientId,
        'Accept': 'application/json'
      }
    });

    if (!response.data.success) {
      throw new Error(`Failed to search contracts: ${response.data.message}`);
    }

    // Transform data to standard format
    return response.data.data.map(contract => ({
      token: contract.token,
      symbol: contract.tradingSymbol,
      strike: contract.strikePrice || 0,
      optionType: contract.optionType || 'N/A',
      expiry: contract.expiry ? new Date(contract.expiry).toLocaleDateString() : 'N/A',
      exchange: contract.exchange || 'NFO'
    }));
  } catch (error) {
    throw new Error(`Error searching contracts with Dhan API: ${error.message}`);
  }
}

// Run the main function
main().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
