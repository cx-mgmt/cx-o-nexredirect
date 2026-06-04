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
curl -sSL https://forgejo.mgmt.corexmanagement.de/admin_hg/cx-nexredirect/main/scripts/install.sh | sudo bash
```

Anschließend Setup unter `http://<server-ip>/setup` aufrufen.

→ Vollständige Anleitung im **[Wiki](https://forgejo.mgmt.corexmanagement.de/admin_hg/cx-nexredirect/wiki)**.

## Dokumentation

Komplette Doku ist im **[GitHub Wiki](https://forgejo.mgmt.corexmanagement.de/admin_hg/cx-nexredirect/wiki)**:

- [Installation](https://forgejo.mgmt.corexmanagement.de/admin_hg/cx-nexredirect/wiki/Installation)
- [DNS Setup](https://forgejo.mgmt.corexmanagement.de/admin_hg/cx-nexredirect/wiki/DNS-Setup)
- [Domain Management](https://forgejo.mgmt.corexmanagement.de/admin_hg/cx-nexredirect/wiki/Domain-Management)
- [Sunset Pages](https://forgejo.mgmt.corexmanagement.de/admin_hg/cx-nexredirect/wiki/Sunset-Pages)
- [Analytics & Reports](https://forgejo.mgmt.corexmanagement.de/admin_hg/cx-nexredirect/wiki/Analytics-&-Reports)
- [Bot Filter](https://forgejo.mgmt.corexmanagement.de/admin_hg/cx-nexredirect/wiki/Bot-Filter)
- [CLI](https://forgejo.mgmt.corexmanagement.de/admin_hg/cx-nexredirect/wiki/CLI)
- [API](https://forgejo.mgmt.corexmanagement.de/admin_hg/cx-nexredirect/wiki/API)
- [Updates](https://forgejo.mgmt.corexmanagement.de/admin_hg/cx-nexredirect/wiki/Updates)
- [Architecture](https://forgejo.mgmt.corexmanagement.de/admin_hg/cx-nexredirect/wiki/Architecture)
- [Troubleshooting](https://forgejo.mgmt.corexmanagement.de/admin_hg/cx-nexredirect/wiki/Troubleshooting)

## Stack

- Next.js 15 + TypeScript + TailwindCSS + Radix UI + Recharts
- better-sqlite3 (eine Datei in `/var/lib/corex-nexredirect/nexredirect.db`)
- Caddy (Auto-HTTPS, Reverse-Proxy)
- MaxMind GeoLite2-Country (lokal, optional)
- NextAuth Credentials + bcryptjs
- puppeteer-core + Chromium (PDF-Export)

## Lokale Entwicklung

```bash
git clone https://forgejo.mgmt.corexmanagement.de/admin_hg/cx-nexredirect
cd CoreX-NexRedirect
npm install
npm run dev
```

Setup unter `http://localhost:3000/setup`.

## Lizenz

[MIT](LICENSE) — viel Spaß damit.
