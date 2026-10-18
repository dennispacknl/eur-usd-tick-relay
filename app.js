// Node.js server that connects to OANDA streaming prices and relays ticks via WebSocket
// Configure via .env or environment variables (see .env.example)
require('dotenv').config();
const http = require('http');
const https = require('https');
const express = require('express');
const WebSocket = require('ws');
const process = require('process');

const app = express();
const PORT = process.env.PORT || 3000;
const OANDA_TOKEN = process.env.OANDA_TOKEN || '';
const OANDA_ACCOUNT_ID = process.env.OANDA_ACCOUNT_ID || '';
const OANDA_ENV = (process.env.OANDA_ENV || 'practice').toLowerCase();

if (!OANDA_TOKEN || !OANDA_ACCOUNT_ID) {
  console.warn('Warning: OANDA_TOKEN or OANDA_ACCOUNT_ID not provided. Server will not attempt streaming until configured.');
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

// OANDA streaming connection management
let streamReq = null;
let reconnectDelay = 1000; // start 1s
const MAX_RECONNECT = 60000; // max 60s
let active = false;

function startOandaStream() {
  if (!OANDA_TOKEN || !OANDA_ACCOUNT_ID) {
    console.log('OANDA not configured, skipping stream startup.');
    return;
  }
  if (active) return;
  active = true;

  const host = OANDA_ENV === 'live' ? 'stream-fxtrade.oanda.com' : 'stream-fxpractice.oanda.com';
  const path = `/v3/accounts/${encodeURIComponent(OANDA_ACCOUNT_ID)}/pricing/stream?instruments=EUR_USD`;

  const options = {
    hostname: host,
    port: 443,
    path,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${OANDA_TOKEN}`,
      'Accept-Datetime-Format': 'RFC3339'
    },
  };

  console.log(`Connecting to OANDA stream ${host}${path}`);

  streamReq = https.request(options, (res) => {
    console.log('OANDA stream status', res.statusCode);
    if (res.statusCode !== 200) {
      broadcast({ type: 'ERROR', message: 'OANDA stream status ' + res.statusCode });
      cleanupAndReconnect();
      return;
    }

    let buffer = '';
    res.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.type === 'PRICE') {
            const tick = {
              type: 'PRICE',
              instrument: msg.instrument,
              time: msg.time,
              bids: msg.bids,
              asks: msg.asks,
              closeoutBid: msg.closeoutBid,
              closeoutAsk: msg.closeoutAsk
            };
            broadcast(tick);
          } else {
            // forward heartbeat / other messages if desired
            broadcast(msg);
          }
        } catch (err) {
          console.warn('Failed to parse line from OANDA stream:', err.message);
        }
      }
    });

    res.on('end', () => {
      console.log('OANDA stream ended');
      cleanupAndReconnect();
    });
  });

  streamReq.on('error', (err) => {
    console.error('OANDA stream error', err.message);
    cleanupAndReconnect();
  });

  streamReq.setTimeout(60 * 60 * 1000); // 1 hour
  streamReq.end();
}

function cleanupAndReconnect() {
  active = false;
  try { if (streamReq) streamReq.abort(); } catch (e) {}
  streamReq = null;
  console.log(`Reconnecting in ${reconnectDelay} ms`);
  setTimeout(() => {
    startOandaStream();
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT);
  }, reconnectDelay);
}

// Start/stop stream based on connected clients
let checkClientsInterval = setInterval(() => {
  if (wss.clients.size > 0 && !active) {
    reconnectDelay = 1000;
    startOandaStream();
  }
  if (wss.clients.size === 0 && active) {
    console.log('No clients connected; stopping upstream stream.');
    try { if (streamReq) streamReq.abort(); } catch (e) {}
    active = false;
    streamReq = null;
  }
}, 2000);

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log('WebSocket path: ws://<host>:' + PORT + '/stream');
  console.log('Serve static files from ./public (put your index.html there)');
});
