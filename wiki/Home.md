# CoreX NexRedirect

Self-hosted Domain-Redirect-Server mit Web-Admin-UI, Per-Domain-Analytics und One-Line Install.

## Was macht NexRedirect?

Du hast viele Domains, die nur auf eine andere Webseite weiterleiten sollen — und willst wissen, welche davon überhaupt noch genutzt werden? NexRedirect:

- nimmt alle deine Redirect-Domains entgegen (DNS auf den Server)
- leitet jeden Aufruf konfigurierbar zum Ziel weiter (302/301)
- protokolliert jeden echten Besuch (Bots gefiltert) mit Land, User-Agent, Referer
- zeigt dir im Web-UI welche Domains tatsächlich genutzt werden — und welche tot sind

## Schnellstart

```bash
curl -sSL https://raw.githubusercontent.com/CoreXManagement/CoreX-NexRedirect/main/scripts/install.sh | sudo bash
```

Setup-Wizard danach: `http://<server-ip>/setup`

→ Detail: [[Installation]]

## Themen

- [[Installation]] — Server aufsetzen
- [[DNS Setup]] — Domains korrekt verbinden
- [[Domain Management]] — Domains, Gruppen, Sunset-Pages
- [[Analytics & Reports]] — Hit-Tracking, PDF-Export, CSV-Export
- [[Bot Filter]] — Wie echte Besucher von Scannern unterschieden werden
- [[CLI]] — Server-CLI `nexredirect`
- [[API]] — REST-API mit Token-Auth
- [[Updates]] — Self-Update und Versions-Strategie
- [[Architecture]] — Wie alles zusammenhängt
- [[Troubleshooting]] — Häufige Probleme und Lösungen

## Stack

Next.js 15 + TypeScript + TailwindCSS + better-sqlite3 (eine Datei) + Caddy (Auto-HTTPS) + MaxMind GeoLite2 + Recharts. Läuft auf Debian/Ubuntu via systemd. Eine `.db`, eine `Caddyfile`, ein Node-Prozess.

## Lizenz

[MIT](https://github.com/CoreXManagement/CoreX-NexRedirect/blob/main/LICENSE) — viel Spaß damit.
