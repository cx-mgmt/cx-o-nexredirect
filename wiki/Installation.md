# Installation

## Voraussetzungen

- Debian 11+ oder Ubuntu 20.04+ Server
- Root-Zugriff (sudo)
- Server-IP öffentlich erreichbar (Port 80 + 443 offen)
- Mindestens 1 GB RAM, 5 GB Disk

## One-Line Install

```bash
curl -sSL https://raw.githubusercontent.com/CoreXManagement/CoreX-NexRedirect/main/scripts/install.sh | sudo bash
```

Das Script:

1. Detect Debian/Ubuntu
2. `apt install`: curl, ca-certificates, gnupg, git, sqlite3, chromium, sudo
3. Caddy via offiziellem Repo
4. Node.js 20 via NodeSource
5. Holt neuestes Release (Tag), zieht Prebuilt `.next`-Tarball aus GitHub-Release
6. Legt Service-User `nexredirect` an, klont Repo nach `/opt/corex-nexredirect`
7. systemd Unit + sudoers für `update.sh`
8. Caddy Bootstrap-Config + reload
9. CLI-Symlink `/usr/local/bin/nexredirect`
10. Service start

Nach `Fertig!`-Meldung: Setup-Wizard unter `http://<server-ip>/setup` aufrufen, Admin-Account anlegen.

## Optional: GeoIP

Land pro Hit nur wenn MaxMind-DB installiert. Entweder beim Install:

```bash
sudo MAXMIND_LICENSE_KEY=xxx ... | sudo -E bash
```

…oder später im UI unter Einstellungen → GeoIP-Tracking → Account-ID + License-Key eintragen → Installieren.

[Lizenz-Key kostenlos hier](https://www.maxmind.com/en/geolite2/signup) generieren.

## Manueller Install

Wer das Curl-Pipe-Bash nicht mag:

```bash
sudo apt install -y caddy nodejs git sqlite3 chromium
sudo useradd --system --home /opt/corex-nexredirect --shell /usr/sbin/nologin nexredirect
sudo mkdir -p /opt/corex-nexredirect /var/lib/corex-nexredirect
sudo git clone https://github.com/CoreXManagement/CoreX-NexRedirect /opt/corex-nexredirect
sudo chown -R nexredirect:nexredirect /opt/corex-nexredirect /var/lib/corex-nexredirect
sudo -u nexredirect bash -c "cd /opt/corex-nexredirect && npm ci && npm run build"
sudo cp /opt/corex-nexredirect/systemd/corex-nexredirect.service /etc/systemd/system/
sudo chown nexredirect:nexredirect /etc/caddy/Caddyfile
sudo systemctl daemon-reload
sudo systemctl enable --now caddy corex-nexredirect
```

## Verzeichnisstruktur

| Pfad | Zweck |
|---|---|
| `/opt/corex-nexredirect` | Code (git checkout) |
| `/var/lib/corex-nexredirect/nexredirect.db` | SQLite (alle Daten) |
| `/var/lib/corex-nexredirect/GeoLite2-Country.mmdb` | Geo-DB (optional) |
| `/etc/caddy/Caddyfile` | Caddy-Config (auto-generated) |
| `/etc/systemd/system/corex-nexredirect.service` | systemd-Unit |
| `/etc/sudoers.d/corex-nexredirect` | Sudo-Privileg für `update.sh` |
| `/usr/local/bin/nexredirect` | CLI-Symlink |

## Backup

```bash
nexredirect backup [/path/zu.tar.gz]
```

Sichert `nexredirect.db` (+ WAL/SHM) und `Caddyfile`. Restore:

```bash
sudo systemctl stop corex-nexredirect caddy
sudo tar -xzf nexredirect-backup-XXX.tar.gz -C /
sudo chown nexredirect:nexredirect /var/lib/corex-nexredirect/*.db
sudo systemctl start caddy corex-nexredirect
```

## Deinstallation

```bash
sudo nexredirect uninstall
```

Entfernt Service, Files, Sudoers, CLI. **DB unter `/var/lib/corex-nexredirect/` bleibt erhalten** — separat löschen wenn gewollt.

→ Weiter mit [[DNS Setup]]
