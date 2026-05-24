const pLimitModule = require('p-limit');
const pLimit = pLimitModule.default || pLimitModule;
function startWorker(db, options, sse) {
  const { interval = 30000, concurrency = 10 } = options || {};
  const limit = pLimit(concurrency);

  async function checkService(svc) {
    const id = svc.id;
    let status = 'down';
    let responseMs = null;
    try {
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(svc.url, { signal: controller.signal });
        responseMs = Date.now() - start;
        if (res.ok) status = 'up';
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      status = 'down';
    }

    db.addCheck(id, status, responseMs);
    db.updateStatus(id, status);
    if (sse) sse.broadcast({ type: 'check', serviceId: id, status, responseMs, checked_at: new Date().toISOString() });
  }

  async function runChecks() {
    const services = db.getAllServices().filter(s => s.enabled === 1 || s.enabled === '1');
    const tasks = services.map(svc => limit(() => checkService(svc)));
    await Promise.all(tasks);
  }

  const timer = setInterval(() => {
    runChecks().catch((e) => console.error('Worker error', e));
  }, interval);

  // run once on start
  runChecks().catch((e) => console.error('Worker error', e));

  return {
    stop: () => clearInterval(timer),
  };
}

module.exports = { startWorker };
