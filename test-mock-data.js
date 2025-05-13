/**
 * Simple test script to demonstrate mock market data
 */

require('dotenv').config();
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Mock contract data
const mockContracts = [
  {
    token: '43854',
    symbol: 'NIFTY',
    strike: 24000,
    optionType: 'CE',
    expiry: '2023-12-28',
    exchange: 'NSE_FO'
  },
  {
    token: '43855',
    symbol: 'NIFTY',
    strike: 24500,
    optionType: 'CE',
    expiry: '2023-12-28',
    exchange: 'NSE_FO'
  },
  {
    token: '43856',
    symbol: 'NIFTY',
    strike: 23500,
    optionType: 'CE',
    expiry: '2023-12-28',
    exchange: 'NSE_FO'
  },
  {
    token: '43857',
    symbol: 'NIFTY',
    strike: 24000,
    optionType: 'PE',
    expiry: '2023-12-28',
    exchange: 'NSE_FO'
  }
];

// Mock price data
const mockPriceData = {};

// Generate mock price data for each contract
mockContracts.forEach(contract => {
  const basePrice = contract.optionType === 'CE' 
    ? Math.max(0, (contract.strike - 24000) * -1 + 500)
    : Math.max(0, (contract.strike - 24000) + 500);
  
  mockPriceData[contract.token] = {
    currentPrice: basePrice,
    priceHistory: []
  };
  
  // Generate some price history
  for (let i = 0; i < 10; i++) {
    const timestamp = new Date(Date.now() - (10 - i) * 60000).toISOString();
    const price = basePrice * (1 + (Math.random() * 0.1 - 0.05));
    
    mockPriceData[contract.token].priceHistory.push({
      timestamp,
      price
    });
  }
});

/**
 * Main function
 */
async function main() {
  console.log('Paper Trading Mock Data Demo');
  console.log('============================\n');
  
  // Display available contracts
  console.log('Available Contracts:');
  console.log('-------------------');
  console.log('Token    | Symbol | Strike  | Type | Expiry');
  console.log('-------------------------------------------');
  
  mockContracts.forEach(contract => {
    console.log(`${contract.token.padEnd(8)}| ${contract.symbol.padEnd(7)}| ${contract.strike.toString().padEnd(8)}| ${contract.optionType.padEnd(5)}| ${contract.expiry}`);
  });
  
  console.log('\n');
  
  // Ask user to select a contract
  rl.question('Enter a token to view price data (or "all" to see all): ', token => {
    if (token.toLowerCase() === 'all') {
      // Display all contracts
      Object.keys(mockPriceData).forEach(tok => {
        displayPriceData(tok);
      });
      rl.close();
    } else if (mockPriceData[token]) {
      // Display selected contract
      displayPriceData(token);
      rl.close();
    } else {
      console.log(`Token ${token} not found. Please try again.`);
      rl.close();
    }
  });
}

/**
 * Display price data for a token
 */
function displayPriceData(token) {
  const contract = mockContracts.find(c => c.token === token);
  const data = mockPriceData[token];
  
  console.log(`\nPrice Data for ${contract.symbol} ${contract.strike} ${contract.optionType} (Token: ${token}):`);
  console.log('---------------------------------------------------');
  console.log('Current Price:', data.currentPrice.toFixed(2));
  console.log('\nPrice History:');
  console.log('Timestamp           | Price');
  console.log('---------------------------');
  
  data.priceHistory.forEach(entry => {
    const time = entry.timestamp.split('T')[1].substring(0, 8);
    console.log(`${time} | ${entry.price.toFixed(2)}`);
  });
  
  // Calculate statistics
  const prices = data.priceHistory.map(entry => entry.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  
  console.log('\nStatistics:');
  console.log(`- Minimum price: ${min.toFixed(2)}`);
  console.log(`- Maximum price: ${max.toFixed(2)}`);
  console.log(`- Average price: ${avg.toFixed(2)}`);
  console.log(`- Price range: ${(max - min).toFixed(2)}`);
  
  // Simulate real-time updates
  console.log('\nSimulating real-time updates (5 seconds):');
  let count = 0;
  const interval = setInterval(() => {
    count++;
    const newPrice = data.currentPrice * (1 + (Math.random() * 0.02 - 0.01));
    const change = newPrice - data.currentPrice;
    const changePercent = (change / data.currentPrice) * 100;
    
    data.currentPrice = newPrice;
    
    console.log(`Update ${count}: ${newPrice.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}, ${change >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`);
    
    if (count >= 5) {
      clearInterval(interval);
      console.log('\nReal-time updates completed.');
    }
  }, 1000);
}

// Run the main function
main();
