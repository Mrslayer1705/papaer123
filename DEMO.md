# Paper Trading Widget - Demo Guide

This guide explains how to run the demos for the Paper Trading Widget.

## Prerequisites

1. Make sure you have Node.js installed
2. Install dependencies: `npm install`
3. Create a `.env` file based on `.env.example`
4. Start the server: `npm run dev`

## Demo Options

There are three ways to test the Paper Trading Widget:

1. **Interactive CLI Demo**: A command-line interface for testing all API endpoints
2. **WebSocket Demo**: A web interface for testing real-time updates
3. **Automated Test**: A script that runs through the entire workflow automatically

## 1. Interactive CLI Demo

The CLI demo provides a menu-driven interface to test all API endpoints.

### How to Run

```bash
node test/demoApiCalls.js
```

### Features

- Create paper trades
- Get all trades (open, closed, or all)
- Get details for a specific trade
- Square off trades
- Run an automated demo sequence

### Example Output

```
┌─────────────────────────────────────────┐
│       PAPER TRADING WIDGET DEMO        │
└─────────────────────────────────────────┘
1. Create a new paper trade
2. Get all trades
3. Get open trades
4. Get closed trades
5. Get trade details (by ID)
6. Square off a trade
7. Run automated demo
0. Exit

Enter your choice:
```

## 2. WebSocket Demo

The WebSocket demo provides a web interface for testing real-time updates.

### How to Run

1. Start the server: `npm run dev`
2. Open in your browser: http://localhost:5000/websocket-demo.html

### Features

- Create paper trades through a form
- See real-time price and PnL updates via WebSocket
- Square off trades
- View WebSocket events in real-time

## 3. Automated Test

The automated test runs through the entire workflow automatically.

### How to Run

```bash
node test/testPaperTrade.js
```

### What It Does

1. Creates a paper trade
2. Waits for price updates
3. Gets the trade details
4. Squares off the trade
5. Shows the final results

## API Endpoints

Here are the API endpoints you can test:

### Create a Paper Trade
```
POST /api/paper-trade/order
```
Request body:
```json
{
  "symbol": "NIFTY",
  "strike": "24000",
  "optionType": "CE",
  "action": "BUY",
  "lotSize": 75,
  "contractToken": "43854",
  "expiry": "09 Apr, 2025"
}
```

### Square Off a Paper Trade
```
POST /api/paper-trade/square-off
```
Request body:
```json
{
  "orderId": "abc123"
}
```

### Get All Trades
```
GET /api/trades
```
Query parameters:
- `status`: Filter by status (`open` or `closed`)

### Get a Single Trade
```
GET /api/trades/:id
```

## WebSocket Events

The widget emits the following WebSocket events:

- `trade-executed`: When a new trade is created
- `market-update:{token}`: When market price updates for a token
- `pnl-update:{orderId}`: When PnL changes for an order
- `trade-squared-off`: When a trade is squared off

## Troubleshooting

### Server Not Starting

- Check if MongoDB is running
- Verify your `.env` file has the correct configuration
- Make sure the port (default: 5000) is not in use

### API Calls Failing

- Ensure the server is running
- Check the server console for error messages
- Verify you're using the correct endpoint and request format

### WebSocket Not Connecting

- Make sure the server is running
- Check if your browser supports WebSocket
- Look for connection errors in the browser console
