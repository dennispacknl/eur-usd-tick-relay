// WebSocket client for browser that connects to /stream and calls window.updateUI(price, time)
(function () {
  const WS_URL = (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host + '/stream';
  let socket;
  let reconnectMs = 1000;

  function connect() {
    socket = new WebSocket(WS_URL);

    socket.addEventListener('open', () => {
      console.log('Connected to tick server');
      reconnectMs = 1000;
    });

    socket.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'PRICE' && (msg.instrument === 'EUR_USD' || msg.instrument === 'EUR_USD')) {
          const ask = parseFloat(msg.closeoutAsk);
          const bid = parseFloat(msg.closeoutBid);
          const price = (isFinite(ask) && isFinite(bid)) ? ((ask + bid) / 2) : (isFinite(ask) ? ask : bid);
          if (typeof window.updateUI === 'function') {
            window.updateUI(price, msg.time || new Date().toISOString());
          }
        } else if (msg.type === 'HEARTBEAT') {
          // optional: handle heartbeat
        } else if (msg.type === 'ERROR' || msg.type === 'INFO') {
          console.log('server message', msg);
        }
      } catch (e) {
        console.warn('Invalid WS message', e);
      }
    });

    socket.addEventListener('close', () => {
      console.log('Disconnected from tick server, reconnecting in', reconnectMs);
      setTimeout(connect, reconnectMs);
      reconnectMs = Math.min(reconnectMs * 1.5, 30000);
    });

    socket.addEventListener('error', (err) => {
      console.warn('WebSocket error', err);
      socket.close();
    });
  }

  connect();
})();
