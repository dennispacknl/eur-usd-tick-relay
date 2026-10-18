// Node.js server that connects to Finnhub WebSocket and relays forex ticks via WebSocket to browser clients
// Configure via .env or environment variables (see .env.example)
require('dotenv').config();
const http = require('http');
const express = require('express');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;
const FINNHUB_TOKEN = process.env.FINNHUB_TOKEN || '';
const FINNHUB_SYMBOL = process.env.FINNHUB_SYMBOL || 'OANDA:EUR_USD';

if (!FINNHUB_TOKEN) {
  console.warn('Warning: FINNHUB_TOKEN not provided. Server will not attempt upstream streaming until configured.');
}

// serve static files from public
app.use(express.static('public'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/stream' });

wss.on('connection', (ws) => {
  console.log('Client connected, total:', wss.clients.size);
  ws.send(JSON.stringify({ type: 'INFO', message: 'connected to tick relay' }));
  ws.on('close', () => console.log('Client disconnected, total:', wss.clients.size));
});

function broadcast(obj) {
  const payload = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

// Finnhub upstream client management
let upstream = null;
let reconnectDelay = 1000; // start 1s
const MAX_RECONNECT = 60000; // max 60s
let upstreamActive = false;

function startFinnhubStream() {
  if (!FINNHUB_TOKEN) {
    console.log('Finnhub not configured, skipping upstream startup.');
    return;
  }
  if (upstreamActive) return;
  upstreamActive = true;

  const url = `wss://ws.finnhub.io?token=${encodeURIComponent(FINNHUB_TOKEN)}`;
  console.log('Connecting to Finnhub upstream:', url);

  upstream = new WebSocket(url);

  upstream.on('open', () => {
    console.log('Connected to Finnhub WS, subscribing to', FINNHUB_SYMBOL);
    upstream.send(JSON.stringify({ type: 'subscribe', symbol: FINNHUB_SYMBOL }));
    // reset backoff
    reconnectDelay = 1000;
  });

  upstream.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      // trade messages: {type: 'trade', data: [{s: 'OANDA:EUR_USD', p: 1.10, t: 158... , v: ...}, ...]}
      if (msg.type === 'trade' && Array.isArray(msg.data)) {
        for (const d of msg.data) {
          const price = (typeof d.p === 'number') ? d.p : parseFloat(d.p);
          const time = (typeof d.t === 'number') ? new Date(d.t).toISOString() : (d.t ? new Date(d.t).toISOString() : new Date().toISOString());
          const tick = {
            type: 'PRICE',
            instrument: d.s || FINNHUB_SYMBOL,
            price: price,
            time: time,
            volume: d.v || null,
            raw: d
          };
          broadcast(tick);
        }
      } else {
        // forward other messages (info / ping / etc.) for debugging
        broadcast(msg);
      }
    } catch (err) {
      console.warn('Failed to parse message from Finnhub upstream:', err.message);
    }
  });

  upstream.on('close', (code, reason) => {
    console.log('Finnhub upstream closed', code, reason && reason.toString());
    cleanupAndReconnect();
  });

  upstream.on('error', (err) => {
    console.error('Finnhub upstream error', err && err.message);
    try { upstream.close(); } catch (e) {}
    cleanupAndReconnect();
  });
}

function cleanupAndReconnect() {
  upstreamActive = false;
  try { if (upstream) upstream.terminate(); } catch (e) {}
  upstream = null;
  console.log(`Reconnecting to Finnhub in ${reconnectDelay} ms`);
  setTimeout(() => {
    startFinnhubStream();
    reconnectDelay = Math.min(Math.floor(reconnectDelay * 2), MAX_RECONNECT);
  }, reconnectDelay);
}

// Start/stop upstream based on connected clients
let checkClientsInterval = setInterval(() => {
  if (wss.clients.size > 0 && !upstreamActive) {
    reconnectDelay = 1000;
    startFinnhubStream();
  }
  if (wss.clients.size === 0 && upstreamActive) {
    console.log('No clients connected; stopping upstream connection.');
    try { if (upstream) upstream.close(); } catch (e) {}
    upstreamActive = false;
    upstream = null;
  }
}, 2000);

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log('WebSocket path: ws://<host>:' + PORT + '/stream');
  console.log('Serve static files from ./public (put your index.html there)');
});
