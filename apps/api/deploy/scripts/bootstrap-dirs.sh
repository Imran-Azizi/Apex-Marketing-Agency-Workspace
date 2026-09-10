#!/usr/bin/env bash
# One-shot VPS bootstrap helpers (run as root on Ubuntu).
# Review before running. Prefer following DEPLOYMENT.md step-by-step.

set -euo pipefail

APP_USER="${APP_USER:-apex}"
APP_DIR="${APP_DIR:-/var/www/apex}"

id -u "$APP_USER" &>/dev/null || useradd --system --create-home --shell /bin/bash "$APP_USER"
mkdir -p "$APP_DIR" /var/log/apex /var/backups/apex /var/www/certbot
chown -R "$APP_USER:$APP_USER" "$APP_DIR" /var/log/apex
chmod 750 /var/log/apex /var/backups/apex

echo "[ok] user=$APP_USER dir=$APP_DIR"
