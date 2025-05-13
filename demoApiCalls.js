/**
 * Paper Trading Widget - API Demo
 * 
 * This script demonstrates how to use the paper trading API endpoints
 * to create trades, monitor PnL, and square off trades.
 */

const axios = require('axios');
const moment = require('moment');
const readline = require('readline');

// Configuration
const API_URL = 'http://localhost:5000/api';
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m'
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Format expiry date for the next month
const nextMonth = moment().add(1, 'month');
const expiryDate = nextMonth.format('DD MMM, YYYY');

// Sample trade data
const tradeData = {
  symbol: 'NIFTY',
  strike: '24000',
  optionType: 'CE',
  action: 'BUY',
  lotSize: 75,
  contractToken: '43854',
  expiry: expiryDate
};

/**
 * Display a formatted API request
 */
function displayApiRequest(method, endpoint, data = null) {
  console.log('\n' + COLORS.bright + COLORS.blue + '┌─────────────────────────────────────────┐');
  console.log(`│ API Request: ${method} ${endpoint} │`);
  console.log('└─────────────────────────────────────────┘' + COLORS.reset);
  
  if (data) {
    console.log(COLORS.cyan + 'Request Body:' + COLORS.reset);
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Display a formatted API response
 */
function displayApiResponse(response) {
  const success = response.success === true;
  const headerColor = success ? COLORS.green : COLORS.red;
  const statusText = success ? 'SUCCESS' : 'ERROR';
  
  console.log('\n' + headerColor + COLORS.bright + '┌─────────────────────────────────────────┐');
  console.log(`│ API Response: ${statusText.padEnd(28)} │`);
  console.log('└─────────────────────────────────────────┘' + COLORS.reset);
  
  console.log(COLORS.cyan + 'Response Data:' + COLORS.reset);
  console.log(JSON.stringify(response, null, 2));
}

/**
 * Create a paper trade
 */
async function createTrade() {
  try {
    displayApiRequest('POST', '/paper-trade/order', tradeData);
    
    console.log(COLORS.yellow + '\nSending request...' + COLORS.reset);
    const response = await axios.post(`${API_URL}/paper-trade/order`, tradeData);
    
    displayApiResponse(response.data);
    return response.data.orderId;
  } catch (error) {
    console.error(COLORS.red + '\nError creating trade:' + COLORS.reset, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get trade details
 */
async function getTrade(orderId) {
  try {
    displayApiRequest('GET', `/trades/${orderId}`);
    
    console.log(COLORS.yellow + '\nSending request...' + COLORS.reset);
    const response = await axios.get(`${API_URL}/trades/${orderId}`);
    
    displayApiResponse(response.data);
    return response.data.data;
  } catch (error) {
    console.error(COLORS.red + '\nError getting trade:' + COLORS.reset, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get all trades
 */
async function getAllTrades(status = null) {
  try {
    const endpoint = status ? `/trades?status=${status}` : '/trades';
    displayApiRequest('GET', endpoint);
    
    console.log(COLORS.yellow + '\nSending request...' + COLORS.reset);
    const response = await axios.get(`${API_URL}${endpoint}`);
    
    displayApiResponse(response.data);
    return response.data.data;
  } catch (error) {
    console.error(COLORS.red + '\nError getting trades:' + COLORS.reset, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Square off a trade
 */
async function squareOffTrade(orderId) {
  try {
    const squareOffData = { orderId };
    displayApiRequest('POST', '/paper-trade/square-off', squareOffData);
    
    console.log(COLORS.yellow + '\nSending request...' + COLORS.reset);
    const response = await axios.post(`${API_URL}/paper-trade/square-off`, squareOffData);
    
    displayApiResponse(response.data);
    return response.data.data;
  } catch (error) {
    console.error(COLORS.red + '\nError squaring off trade:' + COLORS.reset, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Display a menu and get user choice
 */
function showMenu() {
  console.log('\n' + COLORS.bright + COLORS.magenta + '┌─────────────────────────────────────────┐');
  console.log('│       PAPER TRADING WIDGET DEMO        │');
  console.log('└─────────────────────────────────────────┘' + COLORS.reset);
  console.log(COLORS.cyan + '1.' + COLORS.reset + ' Create a new paper trade');
  console.log(COLORS.cyan + '2.' + COLORS.reset + ' Get all trades');
  console.log(COLORS.cyan + '3.' + COLORS.reset + ' Get open trades');
  console.log(COLORS.cyan + '4.' + COLORS.reset + ' Get closed trades');
  console.log(COLORS.cyan + '5.' + COLORS.reset + ' Get trade details (by ID)');
  console.log(COLORS.cyan + '6.' + COLORS.reset + ' Square off a trade');
  console.log(COLORS.cyan + '7.' + COLORS.reset + ' Run automated demo');
  console.log(COLORS.cyan + '0.' + COLORS.reset + ' Exit');
  
  return new Promise((resolve) => {
    rl.question(COLORS.yellow + '\nEnter your choice: ' + COLORS.reset, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Get order ID from user
 */
function getOrderId() {
  return new Promise((resolve) => {
    rl.question(COLORS.yellow + '\nEnter order ID: ' + COLORS.reset, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Run an automated demo
 */
async function runAutomatedDemo() {
  try {
    console.log(COLORS.bright + COLORS.magenta + '\n=== Running Automated Demo ===' + COLORS.reset);
    
    // Step 1: Create a trade
    console.log(COLORS.cyan + '\nStep 1: Creating a paper trade...' + COLORS.reset);
    const orderId = await createTrade();
    
    // Step 2: Wait for a few seconds
    console.log(COLORS.cyan + '\nStep 2: Waiting for 5 seconds to allow price updates...' + COLORS.reset);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 3: Get trade details
    console.log(COLORS.cyan + '\nStep 3: Getting trade details...' + COLORS.reset);
    await getTrade(orderId);
    
    // Step 4: Wait for a few more seconds
    console.log(COLORS.cyan + '\nStep 4: Waiting for 5 more seconds...' + COLORS.reset);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 5: Square off the trade
    console.log(COLORS.cyan + '\nStep 5: Squaring off the trade...' + COLORS.reset);
    await squareOffTrade(orderId);
    
    // Step 6: Get final trade details
    console.log(COLORS.cyan + '\nStep 6: Getting final trade details...' + COLORS.reset);
    await getTrade(orderId);
    
    console.log(COLORS.bright + COLORS.green + '\n=== Automated Demo Completed Successfully ===' + COLORS.reset);
  } catch (error) {
    console.error(COLORS.bright + COLORS.red + '\n=== Automated Demo Failed ===' + COLORS.reset);
  }
}

/**
 * Main function
 */
async function main() {
  console.log(COLORS.bright + COLORS.magenta + '\nPaper Trading Widget - API Demo' + COLORS.reset);
  console.log(COLORS.yellow + 'Make sure your server is running on http://localhost:5000' + COLORS.reset);
  
  let running = true;
  
  while (running) {
    const choice = await showMenu();
    
    switch (choice) {
      case '1':
        await createTrade();
        break;
      case '2':
        await getAllTrades();
        break;
      case '3':
        await getAllTrades('open');
        break;
      case '4':
        await getAllTrades('closed');
        break;
      case '5':
        const orderId = await getOrderId();
        await getTrade(orderId);
        break;
      case '6':
        const squareOffId = await getOrderId();
        await squareOffTrade(squareOffId);
        break;
      case '7':
        await runAutomatedDemo();
        break;
      case '0':
        console.log(COLORS.green + '\nExiting demo. Goodbye!' + COLORS.reset);
        running = false;
        rl.close();
        break;
      default:
        console.log(COLORS.red + '\nInvalid choice. Please try again.' + COLORS.reset);
    }
    
    if (running) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Start the demo
main().catch(error => {
  console.error(COLORS.red + 'Fatal error:' + COLORS.reset, error);
  rl.close();
  process.exit(1);
});
