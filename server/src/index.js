const path = require('path');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const pino = require('pino');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PORT = process.env.PORT || 49615;
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://webdashboard:webdashboard@127.0.0.1:5432/webdashboard';
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 30000);
const CHECK_CONCURRENCY = Number(process.env.CHECK_CONCURRENCY || 10);

const logger = pino();

const { initDb } = require('./db');
const { createRouter } = require('./api/services');
const { startWorker } = require('./worker');

const app = express();
app.use(bodyParser.json());

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

let worker = null;
let db = null;

async function bootstrap() {
  db = await initDb(DATABASE_URL);
  app.use('/api/services', createRouter(db, { broadcast: sseBroadcast }));

  // serve client if built; register after API routes so /api/* always returns JSON
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  worker = startWorker(db, { interval: POLL_INTERVAL_MS, concurrency: CHECK_CONCURRENCY }, { broadcast: sseBroadcast });
  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'WebDashboard server listening');
  });
}

bootstrap().catch((error) => {
  logger.error({ error }, 'Failed to bootstrap server');
  process.exit(1);
});

process.on('SIGINT', async () => {
  worker && worker.stop && worker.stop();
  if (db && db.close) await db.close();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
  console.error('Unhandled rejection', reason);
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  console.error('Uncaught exception', error);
  process.exit(1);
});
