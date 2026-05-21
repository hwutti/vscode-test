const express = require('express');

function createRouter(db, sse) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const services = db.getAllServices();
    res.json(services);
  });

  router.post('/', (req, res) => {
    const { name, url, enabled } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'name and url required' });
    const id = db.addService(name, url, enabled ? 1 : 0);
    const svc = db.getServiceById(id);
    if (sse) sse.broadcast({ type: 'service:created', service: svc });
    res.status(201).json(svc);
  });

  router.put('/:id', (req, res) => {
    const id = Number(req.params.id);
    const { name, url, enabled } = req.body;
    db.updateService(id, name, url, enabled ? 1 : 0);
    const svc = db.getServiceById(id);
    if (sse) sse.broadcast({ type: 'service:updated', service: svc });
    res.json(svc);
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    db.deleteService(id);
    if (sse) sse.broadcast({ type: 'service:deleted', id });
    res.status(204).end();
  });

  return router;
}

module.exports = { createRouter };
