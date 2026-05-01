# Troubleshooting

## Service läuft nicht

```bash
nexredirect status
nexredirect logs -n 100
```

Häufigste Ursachen:

- **Port 3000 belegt**: anderer Service auf 3000? `ss -tlnp | grep 3000`
- **better-sqlite3 native module fehlt**: nach Update `sudo nexredirect update -f` zwingt npm ci
- **DB-Dateirechte**: `ls -la /var/lib/corex-nexredirect/`. Sollte `nexredirect:nexredirect` gehören
- **NEXTAUTH_SECRET nicht gesetzt**: `systemctl cat corex-nexredirect.service` prüfen

## /domains gibt "Application error"

Spalte fehlt (bei Update von alter Version). Logs prüfen:

```bash
nexredirect logs -n 50 | grep SqliteError
```

Falls `no such column`: Migration nicht durchgelaufen. v0.1.15+ hat Self-Healing (`PRAGMA table_info` Check). Update auf neueste Version + Restart:

```bash
sudo nexredirect update
```

## Domain-Add: DNS-Verify schlägt fehl

```bash
dig +short example.de @8.8.8.8
dig +short example.de @1.1.1.1
```

Output muss die Server-IP sein. Falls nicht:

- DNS noch nicht propagiert (TTL warten)
- A-Record falsch eingetragen (manche Provider erwarten leeres Name-Feld statt `@`)
- DNSSEC-Problem beim Registrar

Server-IP korrekt? `nexredirect db` und `SELECT * FROM settings WHERE key LIKE 'server_%';`

## HTTPS funktioniert nicht trotz active

Caddy braucht eingehend Port 80 für ACME-Challenge:

```bash
sudo nexredirect logs caddy 2>&1 | grep -i acme
journalctl -u caddy -n 50 | grep -i error
```

Häufigste Ursachen:

- Firewall blockt Port 80 (UFW / iptables)
- Cloudflare-Proxy davor → Caddy bekommt CF-IP, ACME schlägt fehl. Cloudflare auf "DNS-only" stellen
- Let's Encrypt Rate-Limit (50 Certs/Woche pro Domain)

## Caddyfile kann nicht geschrieben werden

Bei manueller Migration vor v0.1.9: 

```bash
sudo nexredirect caddy fix-perms
sudo nexredirect caddy regen
```

Setzt Owner auf Service-User und regeneriert + reloaded.

## Update läuft, UI zeigt aber alte Version

Browser-Cache. Hard-Reload (Ctrl+Shift+R) oder Inkognito. v0.1.5+ hat Auto-Reload nach Update integriert.

## Hit-Counter steigt nicht

Wenn Domain `redirect_code = 301`:
Browser cached den Redirect, alle weiteren Aufrufe gehen direkt zum Ziel. NexRedirect setzt `Cache-Control: no-store`, viele Browser ignorieren das aber bei 301.

**Fix**: Auf 302 ändern. v0.1.7+ migriert beim ersten Boot automatisch.

## Hits werden gefiltert obwohl echte User

Modernere Filter (v0.1.19+) prüft Browser-Signal-Header. Sehr alte Browser ohne `Sec-Fetch-Mode` UND ohne `Accept-Language` werden gefiltert.

Im Hit-Log nachschauen: `nexredirect db` und `SELECT * FROM hits ORDER BY ts DESC LIMIT 50;`. Wenn der Browser geloggt wird, ist alles OK. Sonst Bot-Filter zu aggressiv.

## Update.sh: "dubious ownership"

Wenn `update.sh` als root aufgerufen wird aber Repo `nexredirect` gehört. Fix:

```bash
sudo nexredirect update
```

(CLI ruft update.sh über sudo auf und führt git als Service-User aus.) Bei Manuell:

```bash
sudo -u nexredirect git -C /opt/corex-nexredirect pull --ff-only
sudo /opt/corex-nexredirect/scripts/update.sh
```

## PDF-Download: "chrome_not_found"

Chromium fehlt. Beim Update wird's installiert; ältere Installs:

```bash
sudo apt install -y chromium
```

Pfad in der App ist `/usr/bin/chromium` oder `/usr/bin/chromium-browser`. Override via `NEXREDIRECT_CHROME_PATH` in der systemd-Unit-File.

## Logs zu Caddy-Reload-Fehlern

```bash
sudo nexredirect caddy show > /tmp/cur.caddyfile
caddy validate --config /tmp/cur.caddyfile
```

Validate-Output zeigt Syntax-Fehler. Bei Bedarf manuell editieren / Settings im UI korrigieren → `sudo nexredirect caddy regen`.

## Backup wiederherstellen

```bash
sudo systemctl stop corex-nexredirect caddy
sudo tar -xzf nexredirect-backup-XXX.tar.gz -C /
sudo chown nexredirect:nexredirect /var/lib/corex-nexredirect/*.db*
sudo systemctl start caddy corex-nexredirect
```

## Fragen / Bugs

GitHub Issues: https://github.com/CoreXManagement/CoreX-NexRedirect/issues

→ Zurück zu [[Home]]
