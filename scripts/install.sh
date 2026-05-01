#!/usr/bin/env bash
# CoreX NexRedirect — One-line install
# Usage: curl -sSL https://raw.githubusercontent.com/CoreXManagement/CoreX-NexRedirect/main/scripts/install.sh | sudo bash

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Bitte als root ausführen (sudo)."
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "Nur Debian/Ubuntu wird unterstützt."
  exit 1
fi

REPO="${NEXREDIRECT_REPO:-CoreXManagement/CoreX-NexRedirect}"
INSTALL_DIR="${NEXREDIRECT_DIR:-/opt/corex-nexredirect}"
DATA_DIR="${NEXREDIRECT_DATA_DIR:-/var/lib/corex-nexredirect}"
SERVICE_USER="nexredirect"
APP_PORT="${NEXREDIRECT_PORT:-3000}"
NODE_MAJOR=20

echo "==> CoreX NexRedirect Install"
echo "    Repo:    $REPO"
echo "    Install: $INSTALL_DIR"
echo "    Data:    $DATA_DIR"

echo "==> Pakete installieren"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git debian-keyring debian-archive-keyring apt-transport-https sudo sqlite3 chromium

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v 2>/dev/null | cut -c2-3)" != "${NODE_MAJOR}" ]]; then
  echo "==> Node.js ${NODE_MAJOR} installieren"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
fi

if ! command -v caddy >/dev/null 2>&1; then
  echo "==> Caddy installieren"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -qq
  apt-get install -y -qq caddy
fi

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  echo "==> User $SERVICE_USER anlegen"
  useradd --system --home "$INSTALL_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi

echo "==> Latest Release ermitteln"
TARGET_TAG="${NEXREDIRECT_TAG:-}"
if [[ -z "$TARGET_TAG" ]]; then
  TARGET_TAG=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null \
    | grep -m1 '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/' || true)
fi
if [[ -z "$TARGET_TAG" ]]; then
  echo "    (kein Release gefunden — fallback main)"
  TARGET_REF="main"
else
  echo "    Tag: $TARGET_TAG"
  TARGET_REF="$TARGET_TAG"
fi

echo "==> Repo clonen / aktualisieren ($TARGET_REF)"
if [[ -d "$INSTALL_DIR/.git" ]]; then
  git -C "$INSTALL_DIR" fetch --tags --quiet
  git -C "$INSTALL_DIR" reset --hard --quiet "$TARGET_REF" 2>/dev/null || git -C "$INSTALL_DIR" reset --hard --quiet "origin/$TARGET_REF"
else
  rm -rf "$INSTALL_DIR"
  git clone --quiet "https://github.com/${REPO}.git" "$INSTALL_DIR"
  git -C "$INSTALL_DIR" checkout --quiet "$TARGET_REF" 2>/dev/null || true
fi

mkdir -p "$DATA_DIR"
chmod +x "$INSTALL_DIR/scripts/"*.sh
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR" "$DATA_DIR"

echo "==> Dependencies installieren"
sudo -u "$SERVICE_USER" -H bash -c "cd '$INSTALL_DIR' && npm ci --no-audit --no-fund"

echo "==> Prebuilt .next/ versuchen"
PREBUILT_OK=0
if [[ -n "$TARGET_TAG" ]]; then
  ASSET_URL="https://github.com/${REPO}/releases/download/${TARGET_TAG}/nexredirect-next-${TARGET_TAG}.tar.gz"
  if curl -fsSL -o /tmp/next-build.tgz "$ASSET_URL" 2>/dev/null; then
    sudo -u "$SERVICE_USER" -H tar -xzf /tmp/next-build.tgz -C "$INSTALL_DIR"
    rm -f /tmp/next-build.tgz
    PREBUILT_OK=1
    echo "    Prebuilt aus Release übernommen — Build übersprungen."
  else
    echo "    Kein Prebuilt für $TARGET_TAG — baue lokal."
  fi
fi
if [[ $PREBUILT_OK -eq 0 ]]; then
  sudo -u "$SERVICE_USER" -H bash -c "cd '$INSTALL_DIR' && npm run build"
fi

echo "==> GeoLite2-Country DB"
GEOIP_PATH="$DATA_DIR/GeoLite2-Country.mmdb"
if [[ ! -f "$GEOIP_PATH" ]]; then
  if [[ -n "${MAXMIND_LICENSE_KEY:-}" ]]; then
    curl -sSL "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-Country&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz" -o /tmp/geo.tgz
    tar -xzf /tmp/geo.tgz -C /tmp
    find /tmp -name "GeoLite2-Country.mmdb" -exec cp {} "$GEOIP_PATH" \;
    rm -rf /tmp/geo.tgz /tmp/GeoLite2-Country_*
  else
    echo "    (MAXMIND_LICENSE_KEY nicht gesetzt — Geo-Lookup deaktiviert. Später unter Settings nachholen.)"
  fi
  chown "$SERVICE_USER:$SERVICE_USER" "$GEOIP_PATH" 2>/dev/null || true
fi

echo "==> Server-IP ermitteln"
SERVER_IP=$(curl -s4 ifconfig.me || echo "")
SERVER_IPV6=$(curl -s6 ifconfig.me || echo "")
NEXTAUTH_SECRET=$(openssl rand -hex 32)

echo "==> systemd Unit"
cat > /etc/systemd/system/corex-nexredirect.service <<EOF
[Unit]
Description=CoreX NexRedirect
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
Environment=PORT=$APP_PORT
Environment=NEXREDIRECT_DATA_DIR=$DATA_DIR
Environment=NEXREDIRECT_GEOIP_PATH=$GEOIP_PATH
Environment=NEXREDIRECT_CADDYFILE=/etc/caddy/Caddyfile
Environment=NEXREDIRECT_UPDATE_SCRIPT=$INSTALL_DIR/scripts/update.sh
Environment=NEXTAUTH_SECRET=$NEXTAUTH_SECRET
Environment=NEXTAUTH_URL=http://$SERVER_IP
ExecStart=$INSTALL_DIR/node_modules/.bin/tsx $INSTALL_DIR/server.ts
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Allow nexredirect to run update.sh as root via sudo
cat > /etc/sudoers.d/corex-nexredirect <<EOF
$SERVICE_USER ALL=(root) NOPASSWD: $INSTALL_DIR/scripts/update.sh
EOF
chmod 0440 /etc/sudoers.d/corex-nexredirect

echo "==> Caddy Bootstrap-Config"
cat > /etc/caddy/Caddyfile <<EOF
{
  email admin@example.com
}

:80 {
  reverse_proxy localhost:$APP_PORT
}
EOF

# Caddyfile + caddy-data writable by service user, so app can regenerate per-domain blocks
chown -R "$SERVICE_USER:$SERVICE_USER" /etc/caddy/Caddyfile
chmod 644 /etc/caddy/Caddyfile
# Caddy admin API runs as caddy user; allow service user to talk to it (localhost:2019 is fine)

# Server-IPs in DB-Settings schreiben (via tsx)
sudo -u "$SERVICE_USER" -H bash -c "cd '$INSTALL_DIR' && NEXREDIRECT_DATA_DIR='$DATA_DIR' SERVER_IP='$SERVER_IP' SERVER_IPV6='$SERVER_IPV6' ./node_modules/.bin/tsx -e \"import('./lib/db').then(({setSetting})=>{if(process.env.SERVER_IP)setSetting('server_ip',process.env.SERVER_IP);if(process.env.SERVER_IPV6)setSetting('server_ipv6',process.env.SERVER_IPV6);})\"" || \
  echo "    (Server-IP konnte nicht direkt gesetzt werden — manuell via /settings nachholen.)"

echo "==> CLI nach /usr/local/bin/nexredirect verlinken"
ln -sf "$INSTALL_DIR/bin/nexredirect" /usr/local/bin/nexredirect
chmod +x "$INSTALL_DIR/bin/nexredirect"
apt-get install -y -qq sqlite3 >/dev/null 2>&1 || true

systemctl daemon-reload
systemctl enable caddy >/dev/null 2>&1 || true
systemctl reload caddy 2>/dev/null || systemctl restart caddy
systemctl enable --now corex-nexredirect

echo ""
echo "==> Fertig!"
echo ""
echo "    Setup unter:  http://${SERVER_IP}/setup"
echo "    CLI:          nexredirect help"
echo "    Logs:         nexredirect logs"
echo ""
