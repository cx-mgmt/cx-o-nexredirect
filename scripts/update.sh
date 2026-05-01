#!/usr/bin/env bash
# CoreX NexRedirect — Self-update
# Usage: sudo /opt/corex-nexredirect/scripts/update.sh [tag]
# Aufgerufen von der App via sudo (siehe install.sh / sudoers.d/corex-nexredirect)

set -euo pipefail

TAG="${1:-}"
INSTALL_DIR="${NEXREDIRECT_DIR:-/opt/corex-nexredirect}"
SERVICE_USER="nexredirect"

cd "$INSTALL_DIR"

chmod +x "$INSTALL_DIR/scripts/"*.sh 2>/dev/null || true
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

if [[ -n "$TAG" ]]; then
  sudo -u "$SERVICE_USER" -H bash -c "cd '$INSTALL_DIR' && git fetch --tags --quiet && git checkout --quiet '$TAG'"
else
  sudo -u "$SERVICE_USER" -H bash -c "cd '$INSTALL_DIR' && git fetch --quiet && git pull --ff-only --quiet"
fi

sudo -u "$SERVICE_USER" -H bash -c "cd '$INSTALL_DIR' && npm ci --no-audit --no-fund"
sudo -u "$SERVICE_USER" -H bash -c "cd '$INSTALL_DIR' && npm run build"

systemctl restart corex-nexredirect
echo "Update auf $(sudo -u "$SERVICE_USER" -H bash -c "cd '$INSTALL_DIR' && git describe --tags --always") abgeschlossen"
