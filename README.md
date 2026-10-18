# EUR-USD Live Tick Relay (OANDA -> WebSocket -> Browser)

This project connects to OANDA's pricing stream for EUR_USD and relays PRICE messages to browser clients via a WebSocket.

Security: keep your OANDA token secret. Do not put it into client-side code.

Files:
- app.js — Node server (stream to OANDA, relay to browser WS).
- package.json — dependencies.
- public/index.html — frontend UI.
- public/style.css — UI styles.
- public/ws-client.js — WebSocket client for the browser.
- .env.example — sample env file.

Quick start:
1. Copy the files into a directory, e.g. `eurusd-relay/`.
2. Create a `.env` (see `.env.example`) and set:
   - OANDA_TOKEN (your API token)
   - OANDA_ACCOUNT_ID
   - OANDA_ENV=practice (or live)
3. Install:
   npm install
4. Run:
   npm start
5. Open http://localhost:3000 in your browser.

Create a ZIP locally:
- From the project root run:
  zip -r project.zip .

If you want me to push these files to a GitHub repo and provide a downloadable zip URL, say so and I’ll create the repo for you.
