const express = require('express');

function createRouter(db, sse) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const services = await db.getAllServices();
      res.json(services);
    } catch (err) {
      res.status(500).json({ error: 'failed to load services' });
    }
  });

  router.post('/', async (req, res) => {
    const { name, url, enabled } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'name and url required' });
    try {
      const id = await db.addService(name, url, enabled);
      const svc = await db.getServiceById(id);
      if (sse) sse.broadcast({ type: 'service:created', service: svc });
      res.status(201).json(svc);
    } catch (err) {
      res.status(500).json({ error: 'failed to create service' });
    }
  });

  router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const { name, url, enabled } = req.body;
    try {
      await db.updateService(id, name, url, enabled);
      const svc = await db.getServiceById(id);
      if (!svc) return res.status(404).json({ error: 'service not found' });
      if (sse) sse.broadcast({ type: 'service:updated', service: svc });
      res.json(svc);
    } catch (err) {
      res.status(500).json({ error: 'failed to update service' });
    }
  });

  router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    try {
      await db.deleteService(id);
      if (sse) sse.broadcast({ type: 'service:deleted', id });
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: 'failed to delete service' });
    }
  });

  return router;
}

module.exports = { createRouter };
