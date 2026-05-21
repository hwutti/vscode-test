# WebDashboard

Minimal WebDashboard to monitor local webservices.

Run server:

```bash
cd server
npm ci
PORT=49615 node src/index.js
```

Run client in dev:

```bash
cd client
npm ci
npm run dev
```

Production build: build client then start server (server serves built files).
