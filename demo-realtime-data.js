/**
 * Demo script for real-time market data
 * 
 * This script demonstrates how to:
 * 1. Generate mock market data
 * 2. Simulate WebSocket updates
 * 3. Calculate and display P&L
 */

// Configuration
const SYMBOL = 'NIFTY';
const STRIKE = 24000;
const OPTION_TYPE = 'CE';
const TOKEN = '43854';
const ENTRY_PRICE = 500;
const LOT_SIZE = 75;
const UPDATE_INTERVAL = 1000; // 1 second
const DURATION = 30; // 30 seconds

// Store for price updates
const priceUpdates = [];
let currentPrice = ENTRY_PRICE;
let unrealizedPnL = 0;

// Start time
const startTime = new Date();

// Display header
console.log('=================================================');
console.log('  PAPER TRADING REAL-TIME DATA DEMO');
console.log('=================================================');
console.log(`Symbol: ${SYMBOL} ${STRIKE} ${OPTION_TYPE} (Token: ${TOKEN})`);
console.log(`Entry Price: ${ENTRY_PRICE.toFixed(2)}`);
console.log(`Lot Size: ${LOT_SIZE}`);
console.log(`Duration: ${DURATION} seconds`);
console.log('=================================================');
console.log('Time      | Price    | Change   | P&L');
console.log('-------------------------------------------------');

// Function to generate a random price update
function generatePriceUpdate() {
  // Random price change between -1% and +1%
  const changePercent = (Math.random() * 2 - 1) * 0.01;
  const newPrice = currentPrice * (1 + changePercent);
  
  // Calculate P&L
  unrealizedPnL = (newPrice - ENTRY_PRICE) * LOT_SIZE;
  
  // Store the update
  const timestamp = new Date();
  priceUpdates.push({
    timestamp,
    price: newPrice,
    unrealizedPnL
  });
  
  // Update current price
  currentPrice = newPrice;
  
  return {
    timestamp,
    price: newPrice,
    change: newPrice - ENTRY_PRICE,
    changePercent: (newPrice - ENTRY_PRICE) / ENTRY_PRICE * 100,
    unrealizedPnL
  };
}

// Function to display a price update
function displayPriceUpdate(update) {
  const time = update.timestamp.toLocaleTimeString('en-US', { hour12: false });
  const price = update.price.toFixed(2).padEnd(8);
  const change = (update.change >= 0 ? '+' : '') + update.change.toFixed(2).padEnd(8);
  const pnl = (update.unrealizedPnL >= 0 ? '+' : '') + update.unrealizedPnL.toFixed(2);
  
  console.log(`${time} | ${price} | ${change} | ${pnl}`);
}

// Start generating price updates
let updateCount = 0;
const interval = setInterval(() => {
  const update = generatePriceUpdate();
  displayPriceUpdate(update);
  
  updateCount++;
  
  // Stop after specified duration
  if (updateCount >= DURATION) {
    clearInterval(interval);
    
    // Display summary
    console.log('=================================================');
    console.log('SUMMARY:');
    console.log('=================================================');
    
    // Calculate statistics
    const prices = priceUpdates.map(update => update.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const finalPrice = prices[prices.length - 1];
    const finalPnL = unrealizedPnL;
    
    console.log(`Start Price: ${ENTRY_PRICE.toFixed(2)}`);
    console.log(`Final Price: ${finalPrice.toFixed(2)}`);
    console.log(`Change: ${(finalPrice - ENTRY_PRICE).toFixed(2)} (${((finalPrice - ENTRY_PRICE) / ENTRY_PRICE * 100).toFixed(2)}%)`);
    console.log(`Minimum Price: ${min.toFixed(2)}`);
    console.log(`Maximum Price: ${max.toFixed(2)}`);
    console.log(`Average Price: ${avg.toFixed(2)}`);
    console.log(`Price Range: ${(max - min).toFixed(2)}`);
    console.log(`Final P&L: ${finalPnL.toFixed(2)}`);
    console.log(`Updates Received: ${priceUpdates.length}`);
    console.log(`Duration: ${((new Date() - startTime) / 1000).toFixed(2)} seconds`);
    
    // Display P&L chart
    console.log('\nP&L Chart:');
    console.log('=================================================');
    
    // Find min and max P&L for scaling
    const pnls = priceUpdates.map(update => update.unrealizedPnL);
    const minPnL = Math.min(...pnls);
    const maxPnL = Math.max(...pnls);
    const range = Math.max(Math.abs(minPnL), Math.abs(maxPnL));
    
    // Display chart
    const chartWidth = 50;
    priceUpdates.forEach((update, index) => {
      if (index % 3 === 0) { // Display every 3rd update to save space
        const pnl = update.unrealizedPnL;
        const normalizedPnL = pnl / range * (chartWidth / 2);
        
        let bar = '';
        if (pnl >= 0) {
          bar = ' '.repeat(chartWidth / 2) + '█'.repeat(Math.abs(normalizedPnL));
        } else {
          bar = ' '.repeat(chartWidth / 2 - Math.abs(normalizedPnL)) + '█'.repeat(Math.abs(normalizedPnL)) + '|';
        }
        
        console.log(`${bar} ${pnl.toFixed(2)}`);
      }
    });
    
    console.log('=================================================');
    console.log('Demo completed. This simulates the real-time data');
    console.log('that would be received from Kotak/Dhan API.');
    console.log('=================================================');
  }
}, UPDATE_INTERVAL);

// Handle Ctrl+C
process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('\nDemo stopped by user.');
  process.exit(0);
});
