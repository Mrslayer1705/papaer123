/**
 * Simple demo for paper trading with mock data
 */

console.log('Paper Trading Demo with Mock Data');
console.log('=================================');

// Contract details
const contract = {
  symbol: 'NIFTY',
  strike: 24000,
  optionType: 'CE',
  token: '43854',
  expiry: '2023-12-28'
};

console.log(`\nContract: ${contract.symbol} ${contract.strike} ${contract.optionType}`);
console.log(`Token: ${contract.token}`);
console.log(`Expiry: ${contract.expiry}`);

// Trade details
const trade = {
  entryPrice: 500,
  lotSize: 75,
  action: 'BUY',
  entryTime: new Date().toISOString()
};

console.log(`\nTrade: ${trade.action} ${trade.lotSize} lots at ${trade.entryPrice}`);
console.log(`Entry Time: ${trade.entryTime}`);

// Generate mock price updates
console.log('\nSimulating price updates:');
console.log('Time     | Price  | Change | P&L');
console.log('--------------------------------');

let currentPrice = trade.entryPrice;
let totalPnL = 0;

// Generate 10 price updates
for (let i = 0; i < 10; i++) {
  // Wait for 1 second
  const updateTime = new Date();
  
  // Generate random price change
  const priceChange = currentPrice * (Math.random() * 0.02 - 0.01);
  currentPrice += priceChange;
  
  // Calculate P&L
  const pnl = (currentPrice - trade.entryPrice) * trade.lotSize;
  totalPnL = pnl;
  
  // Display update
  const time = updateTime.toLocaleTimeString('en-US', { hour12: false });
  console.log(`${time} | ${currentPrice.toFixed(2)} | ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)} | ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`);
  
  // Simulate delay
  const start = Date.now();
  while (Date.now() - start < 1000) {
    // Busy wait
  }
}

// Square off the trade
console.log('\nSquaring off trade:');
const exitTime = new Date();
const exitPrice = currentPrice;
const realizedPnL = totalPnL;

console.log(`Exit Price: ${exitPrice.toFixed(2)}`);
console.log(`Exit Time: ${exitTime.toISOString()}`);
console.log(`Realized P&L: ${realizedPnL >= 0 ? '+' : ''}${realizedPnL.toFixed(2)}`);

console.log('\nTrade Summary:');
console.log(`${contract.symbol} ${contract.strike} ${contract.optionType} ${trade.action}`);
console.log(`Entry: ${trade.entryPrice.toFixed(2)} | Exit: ${exitPrice.toFixed(2)}`);
console.log(`Change: ${(exitPrice - trade.entryPrice).toFixed(2)} (${((exitPrice - trade.entryPrice) / trade.entryPrice * 100).toFixed(2)}%)`);
console.log(`P&L: ${realizedPnL >= 0 ? '+' : ''}${realizedPnL.toFixed(2)}`);

console.log('\nThis demo simulates the real-time data that would be received from Kotak/Dhan API.');
