#!/usr/bin/env bash
# CoreX NexRedirect — Self-update
# Usage: sudo /opt/corex-nexredirect/scripts/update.sh [tag]
# Aufgerufen von der App via sudo (siehe install.sh / sudoers.d/corex-nexredirect)

set -euo pipefail

TAG="${1:-}"
REPO="${NEXREDIRECT_REPO:-CoreXManagement/CoreX-NexRedirect}"
INSTALL_DIR="${NEXREDIRECT_DIR:-/opt/corex-nexredirect}"
SERVICE_USER="nexredirect"

cd "$INSTALL_DIR"

chmod +x "$INSTALL_DIR/scripts/"*.sh 2>/dev/null || true
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

if [[ -z "$TAG" ]]; then
  TAG=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null \
    | grep -m1 '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/' || true)
fi

if [[ -n "$TAG" ]]; then
  echo "==> Update auf $TAG"
  sudo -u "$SERVICE_USER" -H bash -c "cd '$INSTALL_DIR' && git fetch --tags --quiet && git checkout --quiet '$TAG'"
else
  echo "==> Update auf main (kein Release gefunden)"
  sudo -u "$SERVICE_USER" -H bash -c "cd '$INSTALL_DIR' && git fetch --quiet && git checkout --quiet main && git pull --ff-only --quiet"
fi

sudo -u "$SERVICE_USER" -H bash -c "cd '$INSTALL_DIR' && npm ci --no-audit --no-fund"

PREBUILT_OK=0
if [[ -n "$TAG" ]]; then
  ASSET_URL="https://github.com/${REPO}/releases/download/${TAG}/nexredirect-next-${TAG}.tar.gz"
  if curl -fsSL -o /tmp/next-build.tgz "$ASSET_URL" 2>/dev/null; then
    rm -rf "$INSTALL_DIR/.next"
    sudo -u "$SERVICE_USER" -H tar -xzf /tmp/next-build.tgz -C "$INSTALL_DIR"
    rm -f /tmp/next-build.tgz
    PREBUILT_OK=1
    echo "==> Prebuilt .next/ aus Release übernommen"
  fi
fi
if [[ $PREBUILT_OK -eq 0 ]]; then
  echo "==> Lokal bauen"
  sudo -u "$SERVICE_USER" -H bash -c "cd '$INSTALL_DIR' && npm run build"
fi

# CLI-Symlink aktualisieren falls Pfad neu
ln -sf "$INSTALL_DIR/bin/nexredirect" /usr/local/bin/nexredirect
chmod +x "$INSTALL_DIR/bin/nexredirect" 2>/dev/null || true

systemctl restart corex-nexredirect
echo "Update auf $(sudo -u "$SERVICE_USER" -H bash -c "cd '$INSTALL_DIR' && git describe --tags --always") abgeschlossen"
