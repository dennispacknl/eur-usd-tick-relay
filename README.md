# EUR-USD Live Tick Relay (Finnhub -> WebSocket -> Browser)

This project connects to Finnhub's WebSocket stream for EUR/USD and relays trade/tick messages to browser clients via a WebSocket.

Security: keep your FINNHUB token secret. Do not put it into client-side code.

Files:
- app.js — Node server (connects to Finnhub WS, relays to browser WS).
- package.json — dependencies.
- public/index.html — frontend UI.
- public/style.css — UI styles.
- public/ws-client.js — WebSocket client for the browser.
- .env.example — sample env file.

Quick start:
1. Copy the files into a directory, e.g. `eurusd-relay/`.
2. Create a `.env` (see `.env.example`) and set:
   - FINNHUB_TOKEN (your Finnhub API key)
   - FINNHUB_SYMBOL (optional, default: OANDA:EUR_USD)
3. Install:
   npm install
4. Run:
   npm start
5. Open http://localhost:3000 in your browser.

Notes:
- Finnhub WebSocket endpoint: `wss://ws.finnhub.io?token=YOUR_API_KEY`
- Subscribe to symbols by sending: `{"type":"subscribe","symbol":"OANDA:EUR_USD"}`
- The server relays `trade` messages into simplified `PRICE` messages for the browser.
