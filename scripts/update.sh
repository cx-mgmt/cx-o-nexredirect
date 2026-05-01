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

# Sicherstellen dass sqlite3 + chromium für PDF-Export installiert sind (idempotent)
NEED_INSTALL=()
command -v sqlite3 >/dev/null 2>&1 || NEED_INSTALL+=(sqlite3)
[[ -x /usr/bin/chromium || -x /usr/bin/chromium-browser ]] || NEED_INSTALL+=(chromium)
if [[ ${#NEED_INSTALL[@]} -gt 0 ]]; then
  apt-get install -y -qq "${NEED_INSTALL[@]}" >/dev/null 2>&1 || true
fi

# Caddyfile-Permissions reparieren (App muss schreiben können)
if [[ -f /etc/caddy/Caddyfile ]]; then
  chown "$SERVICE_USER:$SERVICE_USER" /etc/caddy/Caddyfile 2>/dev/null || true
  chmod 644 /etc/caddy/Caddyfile 2>/dev/null || true
fi

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
  CHECKSUM_URL="https://github.com/${REPO}/releases/download/${TAG}/nexredirect-checksums-${TAG}.txt"
  if curl -fsSL -o /tmp/next-build.tgz "$ASSET_URL" 2>/dev/null; then
    VERIFIED=0
    if curl -fsSL -o /tmp/next-checksums.txt "$CHECKSUM_URL" 2>/dev/null; then
      EXPECTED=$(awk '{print $1}' /tmp/next-checksums.txt | head -n1)
      ACTUAL=$(sha256sum /tmp/next-build.tgz | awk '{print $1}')
      if [[ -n "$EXPECTED" && "$EXPECTED" == "$ACTUAL" ]]; then
        VERIFIED=1
        echo "==> SHA256 verifiziert"
      else
        echo "==> ⚠ SHA256-Mismatch — verwerfe Prebuilt"
      fi
      rm -f /tmp/next-checksums.txt
    else
      echo "==> ⚠ Kein Checksum-File für $TAG — überspringe Prebuilt"
    fi
    if [[ $VERIFIED -eq 1 ]]; then
      rm -rf "$INSTALL_DIR/.next"
      sudo -u "$SERVICE_USER" -H tar -xzf /tmp/next-build.tgz -C "$INSTALL_DIR"
      PREBUILT_OK=1
      echo "==> Prebuilt .next/ aus Release übernommen"
    fi
    rm -f /tmp/next-build.tgz
  fi
fi
if [[ $PREBUILT_OK -eq 0 ]]; then
  echo "==> Lokal bauen"
  sudo -u "$SERVICE_USER" -H bash -c "cd '$INSTALL_DIR' && npm run build"
fi

# CLI-Symlink aktualisieren falls Pfad neu
ln -sf "$INSTALL_DIR/bin/nexredirect" /usr/local/bin/nexredirect
chmod +x "$INSTALL_DIR/bin/nexredirect" 2>/dev/null || true

VERSION=$(sudo -u "$SERVICE_USER" -H bash -c "cd '$INSTALL_DIR' && git describe --tags --always")
echo "Update auf $VERSION abgeschlossen — Restart wird in 2s ausgelöst"

# Detach restart so this process can return cleanly to the API caller
# (the API can then respond before its own service gets killed).
( sleep 2 && systemctl restart corex-nexredirect ) >/dev/null 2>&1 &
disown
exit 0
