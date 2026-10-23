# NexRedirect

[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-blue.svg)](LICENSE)

Self-hosted Redirect-Manager. Alte Domains zeigen per DNS auf deinen Server, NexRedirect leitet mit 301 oder 302 weiter und zeigt, welche Domains noch aufgerufen werden.

## Funktionen

- Weiterleitungen pro Domain, festes Ziel oder Gruppe, optional mit Pfad
- Weboberfläche für Domains, Gruppen und Sunset-Pages
- Klickstatistik mit serverseitigem Bot-Filter, optional GeoIP (MaxMind GeoLite2)
- CSV- und PDF-Export der Auswertungen
- Automatisches HTTPS über Caddy
- CLI `nexredirect` und Update aus GitHub Releases
- REST-API mit Token

## Installation

Debian oder Ubuntu, als root:

```bash
curl -sSL https://raw.githubusercontent.com/cx-mgmt/cx-o-nexredirect/prod/scripts/install.sh | sudo bash
```

Das Skript richtet Node.js 20, Caddy und einen systemd-Dienst ein. Danach den Einrichtungsassistenten öffnen:

```text
http://<server-ip>/setup
```

Ausführlich: [wiki/Installation.md](wiki/Installation.md).

## Update

```bash
sudo nexredirect update
```

Ohne Argument nimmt NexRedirect das letzte GitHub-Release. Ein bestimmter Stand geht auch, zum Beispiel `sudo nexredirect update v0.1.36`.

## CLI

`nexredirect help` zeigt Status, Logs, Domains, Backup und Caddy. Die einzelnen Befehle stehen in [wiki/CLI.md](wiki/CLI.md).

## Dokumentation

- [Installation](wiki/Installation.md)
- [DNS-Setup](wiki/DNS-Setup.md)
- [Domain-Management](wiki/Domain-Management.md)
- [Sunset-Pages](wiki/Sunset-Pages.md)
- [Analytics und Reports](wiki/Analytics-&-Reports.md)
- [Bot-Filter](wiki/Bot-Filter.md)
- [API](wiki/API.md)
- [Updates](wiki/Updates.md)
- [Architektur](wiki/Architecture.md)
- [Troubleshooting](wiki/Troubleshooting.md)

## Technik

Next.js 15, React, TypeScript, Tailwind CSS, SQLite (`better-sqlite3`), eigener Node-Server (`server.ts` über `tsx`), Caddy und systemd. Gedacht für Debian und Ubuntu.

Lokal:

```bash
npm install
npm run dev
```

Die Oberfläche liegt dann auf `http://localhost:3000`.

## Mitmachen

Fehler und Ideen als Issue, Änderungen als Pull Request gegen `prod`. Kurz schreiben, was sich ändert und wie man es nachvollzieht. Siehe [CONTRIBUTING.md](CONTRIBUTING.md).

Sicherheitslücken nicht ins Issue schreiben, sondern an security@corexmanagement.de. Siehe [SECURITY.md](SECURITY.md).

## Lizenz

[MIT](LICENSE). Copyright 2026 CoreX Management / Hendrik Garske.
