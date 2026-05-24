# WebDashboard

Sci-fi styled monitoring dashboard for web services.

It checks configured endpoints on an interval, stores results in PostgreSQL, and updates the UI in realtime via Server-Sent Events (SSE).

## Features

- Service management: add, edit, pause/resume, delete
- Realtime status updates via SSE
- Periodic health checks with concurrency control
- Response-time tracking
- PostgreSQL-backed persistence
- One-command Linux deploy script (installs DB + app + systemd service)
- Branding menu in UI (name, labels, colors, theme preset)

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- Process manager: systemd

## Project Structure

```text
client/                  React frontend
server/                  Express backend + deploy scripts
server/src/api/          REST API routes
server/src/db.js         PostgreSQL data layer
server/src/worker.js     Periodic checker worker
server/systemd/          systemd service unit
```

## API Endpoints

- `GET /api/services` list services
- `POST /api/services` create service
- `PUT /api/services/:id` update service
- `DELETE /api/services/:id` delete service
- `GET /api/events` SSE stream (`check`, `service:created`, `service:updated`, `service:deleted`)

## Local Development

Prerequisites:

- Node.js 20+
- PostgreSQL 16+

Create DB/user once (example):

```bash
sudo -u postgres psql -c "CREATE ROLE webdashboard LOGIN PASSWORD 'webdashboard';"
sudo -u postgres psql -c "CREATE DATABASE webdashboard OWNER webdashboard;"
```

Run backend:

```bash
cd server
npm ci
DATABASE_URL=postgresql://webdashboard:webdashboard@127.0.0.1:5432/webdashboard PORT=49615 node src/index.js
```

Run frontend (dev mode):

```bash
cd client
npm ci
npm run dev
```

## Production Install / Deploy (Linux)

The deploy script installs and configures everything:

- `git`, `nodejs`, `postgresql`, `postgresql-contrib`
- PostgreSQL role/database
- `/etc/webdashboard/webdashboard.env`
- frontend build
- systemd service (`webdashboard`)

Run:

```bash
sudo bash /var/lib/webdashboard/app/server/deploy.sh
```

If the repo is owned by another user, use:

```bash
sudo git config --global --add safe.directory /var/lib/webdashboard/app
```

Then update and deploy:

```bash
sudo bash -lc 'set -e; cd /var/lib/webdashboard/app; runuser -u webdashboard -- git pull --ff-only; bash server/deploy.sh'
```

## Runtime Configuration

File:

- `/etc/webdashboard/webdashboard.env`

Example:

```env
DATABASE_URL=postgresql://webdashboard:webdashboard@127.0.0.1:5432/webdashboard
NODE_ENV=production
PORT=49615
POLL_INTERVAL_MS=30000
CHECK_CONCURRENCY=10
```

After config changes:

```bash
sudo systemctl restart webdashboard
```

## Service Operations

Status:

```bash
sudo systemctl status webdashboard --no-pager
```

Logs:

```bash
sudo journalctl -u webdashboard -n 100 --no-pager
```

Manual API check:

```bash
curl -i http://127.0.0.1:49615/api/services
```

## Troubleshooting

### Browser shows JSON parse error

Cause: API returned non-JSON (often HTML error page / old build / route mismatch).

Check:

```bash
curl -i http://127.0.0.1:49615/api/services
```

Expected:

- `HTTP/1.1 200 OK`
- body is JSON (for empty list: `[]`)

### `curl: (7) Failed to connect`

Usually service startup timing or crash.

Check:

```bash
sudo systemctl restart webdashboard
sleep 2
sudo systemctl status webdashboard --no-pager
ss -ltnp | grep 49615 || true
sudo journalctl -u webdashboard -n 100 --no-pager
```

### `fatal: detected dubious ownership`

Run:

```bash
sudo git config --global --add safe.directory /var/lib/webdashboard/app
```

## Security Notes

- Change default DB password in production.
- Restrict access to `/etc/webdashboard/webdashboard.env` (script sets `chmod 600`).
- Consider reverse proxy + TLS for external exposure.

## License

No license file provided yet.
