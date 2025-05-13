/**
 * Paper Trading Platform - Main JavaScript
 * 
 * This file contains the main functionality for the paper trading platform.
 */

document.addEventListener('DOMContentLoaded', () => {
  // API URL
  const API_URL = '/api';
  
  // Connect to WebSocket
  const socket = io();
  
  // DOM elements
  const tradeForm = document.getElementById('tradeForm');
  const refreshTrades = document.getElementById('refreshTrades');
  const activeTrades = document.getElementById('activeTrades');
  const closedTrades = document.getElementById('closedTrades');
  const eventLog = document.getElementById('eventLog');
  const clearLog = document.getElementById('clearLog');
  const openTradesCount = document.getElementById('openTradesCount');
  const closedTradesCount = document.getElementById('closedTradesCount');
  const totalPnL = document.getElementById('totalPnL');
  const winRate = document.getElementById('winRate');
  
  // Set default expiry date to next month
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  document.getElementById('expiry').valueAsDate = nextMonth;
  
  // Initialize
  init();
  
  /**
   * Initialize the application
   */
  function init() {
    // Load trades on page load
    loadTrades();
    
    // Add event listeners
    addEventListeners();
    
    // Setup WebSocket event handlers
    setupWebSocket();
    
    // Log initialization
    addEventLog('Application', { status: 'Initialized' });
  }
  
  /**
   * Add event listeners
   */
  function addEventListeners() {
    // Trade form submission
    tradeForm.addEventListener('submit', createTrade);
    
    // Refresh trades button
    refreshTrades.addEventListener('click', loadTrades);
    
    // Clear log button
    clearLog.addEventListener('click', () => {
      eventLog.innerHTML = '';
    });
  }
  
  /**
   * Setup WebSocket event handlers
   */
  function setupWebSocket() {
    socket.on('connect', () => {
      addEventLog('WebSocket', { status: 'Connected' });
    });
    
    socket.on('disconnect', () => {
      addEventLog('WebSocket', { status: 'Disconnected' });
    });
    
    socket.on('trade-executed', (data) => {
      addEventLog('trade-executed', data);
      loadTrades();
    });
    
    socket.on('trade-squared-off', (data) => {
      addEventLog('trade-squared-off', data);
      loadTrades();
    });
  }
  
  /**
   * Add event to log
   */
  function addEventLog(event, data) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `<span class="log-time">[${timeStr}]</span> <span class="log-event">${event}</span>: <span class="log-data">${JSON.stringify(data)}</span>`;
    eventLog.appendChild(logEntry);
    eventLog.scrollTop = eventLog.scrollHeight;
  }
  
  /**
   * Create a new trade
   */
  async function createTrade(e) {
    e.preventDefault();
    
    // Format expiry date
    const expiry = new Date(document.getElementById('expiry').value);
    const expiryFormatted = expiry.toLocaleDateString('en-US', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
    
    // Create trade data
    const tradeData = {
      symbol: document.getElementById('symbol').value,
      strike: document.getElementById('strike').value,
      optionType: document.getElementById('optionType').value,
      action: document.getElementById('action').value,
      lotSize: parseInt(document.getElementById('lotSize').value),
      contractToken: document.getElementById('contractToken').value,
      expiry: expiryFormatted
    };
    
    try {
      addEventLog('API Request', { 
        method: 'POST', 
        endpoint: '/paper-trade/order', 
        body: tradeData 
      });
      
      const response = await fetch(`${API_URL}/paper-trade/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tradeData)
      });
      
      const data = await response.json();
      addEventLog('API Response', data);
      
      if (data.success) {
        // Show success message
        showAlert('Trade created successfully!', 'success');
        
        // Reset form
        tradeForm.reset();
        document.getElementById('expiry').valueAsDate = nextMonth;
        
        // Load trades
        loadTrades();
        
        // Switch to trades tab
        document.getElementById('trades-tab').click();
      } else {
        showAlert(`Error: ${data.error}`, 'danger');
      }
    } catch (error) {
      console.error('Error creating trade:', error);
      showAlert('Error creating trade. See console for details.', 'danger');
      addEventLog('Error', { message: error.message });
    }
  }
  
  /**
   * Load all trades
   */
  async function loadTrades() {
    try {
      // Load active trades
      const activeResponse = await fetch(`${API_URL}/trades?status=open`);
      const activeData = await activeResponse.json();
      
      // Load closed trades
      const closedResponse = await fetch(`${API_URL}/trades?status=closed`);
      const closedData = await closedResponse.json();
      
      // Render trades
      renderTrades('activeTrades', activeData.data, true);
      renderTrades('closedTrades', closedData.data, false);
      
      // Update dashboard stats
      updateDashboardStats(activeData.data, closedData.data);
      
      // Setup WebSocket listeners for PnL updates
      setupPnLListeners(activeData.data);
    } catch (error) {
      console.error('Error loading trades:', error);
      showAlert('Error loading trades. See console for details.', 'danger');
    }
  }
  
  /**
   * Update dashboard statistics
   */
  function updateDashboardStats(activeTrades, closedTrades) {
    // Update counts
    openTradesCount.textContent = activeTrades.length;
    closedTradesCount.textContent = closedTrades.length;
    
    // Calculate total PnL
    let totalPnLValue = 0;
    let winCount = 0;
    
    // Add unrealized PnL from active trades
    activeTrades.forEach(trade => {
      totalPnLValue += trade.unrealizedPnL || 0;
    });
    
    // Add realized PnL from closed trades and count wins
    closedTrades.forEach(trade => {
      totalPnLValue += trade.realizedPnL || 0;
      if (trade.realizedPnL > 0) winCount++;
    });
    
    // Update total PnL
    totalPnL.textContent = `₹${totalPnLValue.toFixed(2)}`;
    totalPnL.classList.remove('text-success', 'text-danger');
    totalPnL.classList.add(totalPnLValue >= 0 ? 'text-success' : 'text-danger');
    
    // Update win rate
    const winRateValue = closedTrades.length > 0 ? (winCount / closedTrades.length) * 100 : 0;
    winRate.textContent = `${winRateValue.toFixed(0)}%`;
  }
  
  /**
   * Render trades to the DOM
   */
  function renderTrades(containerId, trades, isActive) {
    const container = document.getElementById(containerId);
    
    if (trades.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="bi bi-info-circle fs-1 text-muted"></i>
          <p class="mt-3 text-muted">No ${isActive ? 'active' : 'closed'} trades.</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = '';
    
    trades.forEach(trade => {
      const template = document.getElementById('tradeCardTemplate');
      const clone = document.importNode(template.content, true);
      
      // Set trade details
      const isBuy = trade.flBuyQty > 0;
      clone.querySelector('.trade-symbol').textContent = `${trade.sym} ${trade.stkPrc} ${trade.optTp} ${isBuy ? 'Buy' : 'Sell'}`;
      clone.querySelector('.badge').textContent = trade.status;
      clone.querySelector('.badge').classList.add(trade.status === 'open' ? 'bg-success' : 'bg-secondary');
      
      clone.querySelector('.entry-price').textContent = trade.entryPrice.toFixed(2);
      clone.querySelector('.current-price').textContent = (trade.currentLTP || trade.entryPrice).toFixed(2);
      
      const pnlElement = clone.querySelector('.pnl');
      const pnlValue = trade.status === 'open' ? trade.unrealizedPnL : trade.realizedPnL;
      pnlElement.textContent = pnlValue ? pnlValue.toFixed(2) : '0.00';
      pnlElement.classList.add(pnlValue > 0 ? 'profit' : pnlValue < 0 ? 'loss' : '');
      
      clone.querySelector('.lot-size').textContent = isBuy ? trade.flBuyQty : trade.flSellQty;
      clone.querySelector('.entry-time').textContent = new Date(trade.entryTime).toLocaleString();
      
      // Set exit details if closed
      if (trade.status === 'closed') {
        const exitDetails = clone.querySelector('.exit-details');
        exitDetails.style.display = 'block';
        exitDetails.querySelector('.exit-price').textContent = trade.exitPrice.toFixed(2);
        exitDetails.querySelector('.exit-time').textContent = new Date(trade.exitTime).toLocaleString();
        
        // Hide square off button
        clone.querySelector('.square-off-btn-container').style.display = 'none';
      } else {
        // Add square off event listener
        clone.querySelector('.square-off-btn').addEventListener('click', () => squareOffTrade(trade._id));
      }
      
      // Set card ID for WebSocket updates
      const card = clone.querySelector('.trade-card');
      card.id = `trade-${trade._id}`;
      
      container.appendChild(clone);
    });
  }
  
  /**
   * Setup WebSocket listeners for PnL updates
   */
  function setupPnLListeners(trades) {
    // Remove all previous listeners
    socket.off('pnl-update');
    
    // Add listeners for each active trade
    trades.forEach(trade => {
      socket.on(`pnl-update:${trade._id}`, (data) => {
        updateTradeCard(trade._id, data);
      });
    });
  }
  
  /**
   * Update trade card with new data
   */
  function updateTradeCard(tradeId, data) {
    const card = document.getElementById(`trade-${tradeId}`);
    if (!card) return;
    
    const currentPriceElement = card.querySelector('.current-price');
    const pnlElement = card.querySelector('.pnl');
    
    // Update current price
    currentPriceElement.textContent = data.currentLTP.toFixed(2);
    currentPriceElement.classList.add('price-update');
    setTimeout(() => currentPriceElement.classList.remove('price-update'), 1000);
    
    // Update PnL
    pnlElement.textContent = data.unrealizedPnL.toFixed(2);
    pnlElement.className = 'pnl';
    pnlElement.classList.add(data.unrealizedPnL > 0 ? 'profit' : data.unrealizedPnL < 0 ? 'loss' : '');
    
    // Update dashboard stats
    loadTrades();
  }
  
  /**
   * Square off a trade
   */
  async function squareOffTrade(orderId) {
    if (!confirm('Are you sure you want to square off this trade?')) return;
    
    try {
      addEventLog('API Request', { 
        method: 'POST', 
        endpoint: '/paper-trade/square-off', 
        body: { orderId } 
      });
      
      const response = await fetch(`${API_URL}/paper-trade/square-off`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderId })
      });
      
      const data = await response.json();
      addEventLog('API Response', data);
      
      if (data.success) {
        showAlert('Trade squared off successfully!', 'success');
        loadTrades();
      } else {
        showAlert(`Error: ${data.error}`, 'danger');
      }
    } catch (error) {
      console.error('Error squaring off trade:', error);
      showAlert('Error squaring off trade. See console for details.', 'danger');
      addEventLog('Error', { message: error.message });
    }
  }
  
  /**
   * Show alert message
   */
  function showAlert(message, type) {
    // Create alert element
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type} alert-dismissible fade show`;
    alertElement.role = 'alert';
    alertElement.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Add to document
    const container = document.querySelector('.container');
    container.insertBefore(alertElement, container.firstChild);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      const bsAlert = new bootstrap.Alert(alertElement);
      bsAlert.close();
    }, 5000);
  }
});
