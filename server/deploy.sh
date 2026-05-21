#!/usr/bin/env bash
set -euo pipefail

# Simple deploy script for the WebDashboard (run on target server)
ROOT_DIR="/var/lib/webdashboard/app"
echo "Deploying to ${ROOT_DIR}"
cd "${ROOT_DIR}"
git pull --ff-only
cd server
npm ci
cd ../client
npm ci
npm run build
cd ../server
systemctl restart webdashboard
echo "Deployed."
