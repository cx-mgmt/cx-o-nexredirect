# CoreX NexRedirect

Self-hosted Domain-Redirect-Server mit Web-Admin-UI und Per-Domain-Analytics. Viele Domains zeigen via DNS auf einen einzigen Server, der jede Domain auf das jeweilige Ziel weiterleitet und protokolliert, welche Domains tatsächlich noch genutzt werden — ideal um tote Domains zu identifizieren.

## Features

- **One-Line Install** auf Debian/Ubuntu (Caddy + Node + systemd)
- **Web-Admin-UI** mit Setup-Wizard, Domain-Verwaltung, Analytics
- **Auto-HTTPS** via Caddy (Let's Encrypt automatisch)
- **DNS-Validierung + Live-Übersicht** aller Records (A, AAAA, MX, TXT, NS, CNAME, SOA, CAA)
- **Domain-Gruppen** für gleiches Ziel über mehrere Domains
- **Sunset-Notice-Pages** vor Redirect (per Domain oder Bulk)
- **Per-Domain-Analytics** (Hits, eindeutige Besucher, Geo, "Tote Domains")
- **Bot-Filter** mit Browser-Signal-Heuristik (Sec-Fetch, Accept-Language) + persistenter IP-Blocklist
- **PDF-Export** (Gesamt + Per-Domain) via headless Chromium
- **CSV-Import + Export** für Domains und Hits
- **Audit-Log** aller administrativen Aktionen
- **Public REST-API** mit Token-Auth und Scopes
- **Multi-User** mit Rollen (admin / user)
- **Self-Update** via GitHub-Releases (UI-Banner + Auto-Update opt-in)
- **Webhook-Notifications** bei Events (Domain-Verify-Fail etc.)
- **DSGVO-freundlich**: IP-Hash mit täglich rotierendem Salt, kein Klartext

## Installation

```bash
curl -sSL https://raw.githubusercontent.com/CoreXManagement/CoreX-NexRedirect/main/scripts/install.sh | sudo bash
```

Anschließend Setup unter `http://<server-ip>/setup` aufrufen.

→ Vollständige Anleitung im **[Wiki](https://github.com/CoreXManagement/CoreX-NexRedirect/wiki)**.

## Dokumentation

Komplette Doku ist im **[GitHub Wiki](https://github.com/CoreXManagement/CoreX-NexRedirect/wiki)**:

- [Installation](https://github.com/CoreXManagement/CoreX-NexRedirect/wiki/Installation)
- [DNS Setup](https://github.com/CoreXManagement/CoreX-NexRedirect/wiki/DNS-Setup)
- [Domain Management](https://github.com/CoreXManagement/CoreX-NexRedirect/wiki/Domain-Management)
- [Sunset Pages](https://github.com/CoreXManagement/CoreX-NexRedirect/wiki/Sunset-Pages)
- [Analytics & Reports](https://github.com/CoreXManagement/CoreX-NexRedirect/wiki/Analytics-&-Reports)
- [Bot Filter](https://github.com/CoreXManagement/CoreX-NexRedirect/wiki/Bot-Filter)
- [CLI](https://github.com/CoreXManagement/CoreX-NexRedirect/wiki/CLI)
- [API](https://github.com/CoreXManagement/CoreX-NexRedirect/wiki/API)
- [Updates](https://github.com/CoreXManagement/CoreX-NexRedirect/wiki/Updates)
- [Architecture](https://github.com/CoreXManagement/CoreX-NexRedirect/wiki/Architecture)
- [Troubleshooting](https://github.com/CoreXManagement/CoreX-NexRedirect/wiki/Troubleshooting)

## Stack

- Next.js 15 + TypeScript + TailwindCSS + Radix UI + Recharts
- better-sqlite3 (eine Datei in `/var/lib/corex-nexredirect/nexredirect.db`)
- Caddy (Auto-HTTPS, Reverse-Proxy)
- MaxMind GeoLite2-Country (lokal, optional)
- NextAuth Credentials + bcryptjs
- puppeteer-core + Chromium (PDF-Export)

## Lokale Entwicklung

```bash
git clone https://github.com/CoreXManagement/CoreX-NexRedirect
cd CoreX-NexRedirect
npm install
npm run dev
```

Setup unter `http://localhost:3000/setup`.

## Lizenz

[MIT](LICENSE) — viel Spaß damit.
