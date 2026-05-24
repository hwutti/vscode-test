#!/usr/bin/env bash
set -euo pipefail

# Deploy/update script for Linux target hosts.
ROOT_DIR="/var/lib/webdashboard/app"
DB_NAME="${WEBDASHBOARD_DB_NAME:-webdashboard}"
DB_USER="${WEBDASHBOARD_DB_USER:-webdashboard}"
DB_PASSWORD="${WEBDASHBOARD_DB_PASSWORD:-webdashboard}"
DB_HOST="${WEBDASHBOARD_DB_HOST:-127.0.0.1}"
DB_PORT="${WEBDASHBOARD_DB_PORT:-5432}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Please run as root: sudo bash server/deploy.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y git postgresql postgresql-contrib nodejs npm

id webdashboard >/dev/null 2>&1 || useradd --system --home /var/lib/webdashboard --create-home --shell /usr/sbin/nologin webdashboard
install -d -o webdashboard -g webdashboard /var/lib/webdashboard

if [[ -d "${ROOT_DIR}/.git" ]]; then
  cd "${ROOT_DIR}"
  runuser -u webdashboard -- git pull --ff-only
else
  runuser -u webdashboard -- git clone https://github.com/hwutti/vscode-test.git "${ROOT_DIR}"
  cd "${ROOT_DIR}"
fi

systemctl enable --now postgresql
runuser -u postgres -- psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || runuser -u postgres -- psql -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';"
runuser -u postgres -- psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || runuser -u postgres -- psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

install -d /etc/webdashboard
cat > /etc/webdashboard/webdashboard.env <<EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}
NODE_ENV=production
PORT=49615
POLL_INTERVAL_MS=30000
CHECK_CONCURRENCY=10
EOF
chmod 600 /etc/webdashboard/webdashboard.env

cd "${ROOT_DIR}/server"
runuser -u webdashboard -- npm install
cd ../client
runuser -u webdashboard -- npm install
runuser -u webdashboard -- npm run build

cp "${ROOT_DIR}/server/systemd/webdashboard.service" /etc/systemd/system/webdashboard.service
systemctl daemon-reload
systemctl enable --now webdashboard
systemctl restart webdashboard
systemctl status webdashboard --no-pager

echo "Deployment completed."
