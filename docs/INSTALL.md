# Installation

## One-Line (Debian/Ubuntu)

```bash
curl -sSL https://raw.githubusercontent.com/CoreXManagement/CoreX-NexRedirect/main/scripts/install.sh | sudo bash
```

Optional mit MaxMind-Lizenz für Geo-Lookup:
```bash
sudo MAXMIND_LICENSE_KEY=xxxxxxxx bash -c \
  "$(curl -sSL https://raw.githubusercontent.com/CoreXManagement/CoreX-NexRedirect/main/scripts/install.sh)"
```

Das Script:

1. Prüft Debian/Ubuntu
2. Installiert Caddy (offizielles Repo), Node.js 20, git
3. Legt System-User `nexredirect` an
4. Cloned Repo nach `/opt/corex-nexredirect`
5. `npm ci && npm run build`
6. Holt GeoLite2-Country (falls Lizenz gesetzt)
7. Schreibt systemd-Unit `corex-nexredirect.service`
8. Schreibt minimale Caddyfile-Bootstrap-Config
9. `systemctl enable --now caddy corex-nexredirect`
10. Druckt Setup-URL

## Manueller Install

Wer das Curl-Pipe-Bash nicht mag:

```bash
sudo apt-get install -y caddy nodejs git
sudo useradd --system --home /opt/corex-nexredirect --shell /usr/sbin/nologin nexredirect
sudo mkdir -p /opt/corex-nexredirect /var/lib/corex-nexredirect
sudo git clone https://github.com/CoreXManagement/CoreX-NexRedirect /opt/corex-nexredirect
sudo chown -R nexredirect:nexredirect /opt/corex-nexredirect /var/lib/corex-nexredirect
sudo -u nexredirect bash -c "cd /opt/corex-nexredirect && npm ci && npm run build"
sudo cp /opt/corex-nexredirect/systemd/corex-nexredirect.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now caddy corex-nexredirect
```

Bootstrap-Caddyfile in `/etc/caddy/Caddyfile`:
```
:80 {
  reverse_proxy localhost:3000
}
```

## Verzeichnisse

| Pfad | Inhalt |
|------|--------|
| `/opt/corex-nexredirect` | Code (git checkout) |
| `/var/lib/corex-nexredirect/nexredirect.db` | SQLite (alle Daten) |
| `/var/lib/corex-nexredirect/GeoLite2-Country.mmdb` | Geo-DB (optional) |
| `/etc/caddy/Caddyfile` | Caddy-Config (auto-generated) |
| `/etc/systemd/system/corex-nexredirect.service` | systemd-Unit |
| `/etc/sudoers.d/corex-nexredirect` | Sudo für update.sh |

## Backup / Restore

Sicherung:
```bash
sudo tar -czf nexredirect-backup-$(date +%F).tar.gz \
  /var/lib/corex-nexredirect/nexredirect.db \
  /etc/caddy/Caddyfile
```

Restore:
```bash
sudo systemctl stop corex-nexredirect caddy
sudo tar -xzf nexredirect-backup-XXXX.tar.gz -C /
sudo chown nexredirect:nexredirect /var/lib/corex-nexredirect/nexredirect.db
sudo systemctl start caddy corex-nexredirect
```

SQLite ist im WAL-Modus — Hot-Backup ohne Stop:
```bash
sqlite3 /var/lib/corex-nexredirect/nexredirect.db ".backup /tmp/db.sqlite"
```

## Logs

```bash
journalctl -u corex-nexredirect -f
journalctl -u caddy -f
```

## Deinstallation

```bash
sudo systemctl disable --now corex-nexredirect
sudo rm /etc/systemd/system/corex-nexredirect.service /etc/sudoers.d/corex-nexredirect
sudo systemctl daemon-reload
sudo userdel nexredirect
sudo rm -rf /opt/corex-nexredirect /var/lib/corex-nexredirect
# Caddy + Caddyfile bei Bedarf separat
```
