const path = require('path');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const pino = require('pino');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PORT = process.env.PORT || 49615;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'data.sqlite');
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 30000);
const CHECK_CONCURRENCY = Number(process.env.CHECK_CONCURRENCY || 10);

const logger = pino();

const { initDb } = require('./db');
const { createRouter } = require('./api/services');
const { startWorker } = require('./worker');

const app = express();
app.use(bodyParser.json());

const db = initDb(DB_PATH);

// SSE broadcaster
const sseClients = new Set();
function sseBroadcast(payload) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(msg);
    } catch (e) {
      // ignore
    }
  }
}

app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write('\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

app.use('/api/services', createRouter(db, { broadcast: sseBroadcast }));

// serve client if built
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const worker = startWorker(db, { interval: POLL_INTERVAL_MS, concurrency: CHECK_CONCURRENCY }, { broadcast: sseBroadcast });

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'WebDashboard server listening');
});

process.on('SIGINT', () => {
  worker.stop && worker.stop();
  process.exit(0);
});
