# NexRedirect

> Self-hosted Domain-Redirect-Server mit Web-Oberfläche — schnelle 301/302-Weiterleitungen, Klick-Statistiken und automatischem HTTPS.

**Open Source** · Next.js · Custom-Server (Node/tsx) · SQLite · Caddy

## Installation (One-Line)

Debian/Ubuntu-Server, als root:

```bash
curl -sSL https://raw.githubusercontent.com/cx-mgmt/cx-o-nexredirect/prod/scripts/install.sh | sudo bash
```

Das Skript installiert Node.js 20, Caddy (automatisches HTTPS), richtet den
`systemd`-Dienst ein und startet den Server. Danach:

```
Setup:  http://<server-ip>/setup
CLI:    nexredirect help
Logs:   nexredirect logs
```

## Update

```bash
sudo /opt/corex-nexredirect/scripts/update.sh
```

Oder direkt über die Web-Oberfläche (Settings → Update). NexRedirect prüft
GitHub-Releases automatisch und kann sich selbst aktualisieren.

## Features

- **Domain-Weiterleitungen** — 301/302 pro Host, verwaltet über die Web-UI
- **Klick-Statistiken** — Hit-Tracking mit serverseitigem Bot-Filter
- **GeoIP** (optional, MaxMind GeoLite2) — Herkunft der Besucher
- **Sunset-Pages** — statische Abschaltseiten ohne JS/Tracking
- **Automatisches HTTPS** über Caddy
- **CLI** (`nexredirect`) + Self-Update aus GitHub-Releases

## Dokumentation

Siehe [Wiki](wiki/) — u. a. [Installation](wiki/Installation.md),
[Bot-Filter](wiki/Bot-Filter.md), [Sunset-Pages](wiki/Sunset-Pages.md),
[Troubleshooting](wiki/Troubleshooting.md).

## Entwicklung

```bash
npm install
npm run dev        # http://localhost:3000
```

## Lizenz

[MIT](LICENSE)
