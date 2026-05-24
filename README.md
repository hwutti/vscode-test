# WebDashboard

Minimal WebDashboard to monitor local webservices.

Local development:

```bash
cd server
npm ci
DATABASE_URL=postgresql://webdashboard:webdashboard@127.0.0.1:5432/webdashboard PORT=49615 node src/index.js
```

Run client in dev:

```bash
cd client
npm ci
npm run dev
```

Linux install/deploy (installs PostgreSQL + configures systemd + builds client):

```bash
sudo bash /var/lib/webdashboard/app/server/deploy.sh
```

The service reads `DATABASE_URL` from:

`/etc/webdashboard/webdashboard.env`
