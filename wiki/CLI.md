# CLI

Auf dem Server: `nexredirect <command>` (Symlink in `/usr/local/bin/`).

## Subcommands

```
status            Service-Status (systemctl status)
start             Service starten
stop              Service stoppen
restart           Service neu starten
logs [-n N]       Logs streamen (default: -f live tail)
update [tag]      Auf neueste Version (oder bestimmten Tag); skip wenn schon aktuell
update -f [tag]   Update erzwingen auch wenn Version gleich
version           Aktuelle + neueste Version (von GitHub)
caddy reload      Caddyfile reload via Admin-API
caddy regen       Caddyfile aus DB neu generieren + reloaden
caddy fix-perms   /etc/caddy/Caddyfile dem Service-User übertragen
caddy show        Aktuellen Caddyfile anzeigen
db                SQLite-Shell auf der Datenbank öffnen
domains           Aktive Domains listen
hits [N]          Letzte N Hits (default 20)
tokens            API-Tokens auflisten
backup [PATH]     DB + Caddyfile sichern (default: /tmp/...)
uninstall         Service + Files entfernen (DB bleibt)
help              Hilfe
```

## Beispiele

```bash
# Status checken
nexredirect status

# Live-Logs
nexredirect logs

# Letzte 50 Hits
sudo nexredirect hits 50

# Update auf neueste Version
sudo nexredirect update

# Update auf bestimmten Tag (auch downgrade)
sudo nexredirect update v0.1.10

# Force-Update (gleiche Version neu installieren)
sudo nexredirect update -f

# DB anschauen
sudo nexredirect db
sqlite> SELECT id, domain, status FROM domains;
sqlite> .quit

# Caddyfile anzeigen
nexredirect caddy show

# Backup
sudo nexredirect backup
sudo nexredirect backup /backup/nexredirect-$(date +%F).tgz
```

## Service-User-Konzept

Service läuft als unprivileged user `nexredirect` (UID via `useradd --system`). Die meisten Commands brauchen `sudo` weil sie systemctl / DB-Schreibzugriff benötigen.

`sudo update.sh` ist über `/etc/sudoers.d/corex-nexredirect` als einzige Privileg-Eskalation erlaubt — vom Service-Process selbst aufrufbar wenn das UI "Update installieren" triggert.

→ Weiter mit [[API]]
