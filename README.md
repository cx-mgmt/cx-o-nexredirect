# CoreX NexRedirect

Self-hosted Domain-Redirect-Server mit Web-Admin-UI und Per-Domain-Analytics. Viele Domains zeigen via DNS auf einen einzigen Server, der jede Domain auf das jeweilige Ziel weiterleitet und protokolliert, welche Domains tatsächlich noch genutzt werden — ideal um tote Domains zu identifizieren.

## Features

- **One-Line Install** auf Debian/Ubuntu (Caddy + Node + systemd)
- **Web-Admin-UI** mit Setup-Wizard, Domain-Verwaltung, Analytics
- **Auto-HTTPS** via Caddy (Let's Encrypt automatisch)
- **DNS-Validierung** beim Hinzufügen einer Domain (zeigt fehlende Records)
- **Domain-Gruppen** für gleiches Ziel über mehrere Domains
- **Per-Domain-Analytics** (Hits, Geo, Top-Domains, "Tote Domains")
- **Public REST-API** mit Token-Auth und Scopes
- **Self-Update** via GitHub-Releases (UI-Banner + Auto-Update opt-in)
- **DSGVO-freundlich**: IP-Hash mit täglich rotierendem Salt, kein Klartext

## Installation

```bash
curl -sSL https://raw.githubusercontent.com/CoreXManagement/CoreX-NexRedirect/main/scripts/install.sh | sudo bash
```

Optional vorab MaxMind-Lizenz für Geo-Lookup:
```bash
export MAXMIND_LICENSE_KEY=xxx
curl ... | sudo -E bash
```

Anschließend Setup unter `http://<server-ip>/setup` aufrufen und Admin-Account erstellen.

Details: [docs/INSTALL.md](docs/INSTALL.md)

## Domain hinzufügen

1. **Admin-UI** → "Domains" → "+ Domain hinzufügen"
2. Domain + Ziel-URL (oder Gruppe) eingeben
3. **DNS-Records** beim DNS-Provider eintragen (A/AAAA auf Server-IP)
4. **Validieren** — Server prüft DNS, aktiviert Domain, Caddy reload

Alternativ via API:
```bash
curl -X POST -H "Authorization: Bearer nrx_..." -H "Content-Type: application/json" \
  -d '{"domain":"alt-firma.de","target_url":"https://www.firma.de"}' \
  https://admin.firma.de/api/v1/domains
```

## API

Tokens werden im Web-UI unter **Einstellungen → API-Tokens** erstellt. Tokens haben Scopes (`read:domains`, `write:domains`, `read:analytics`, `read:hits`).

```bash
curl -H "Authorization: Bearer nrx_..." https://admin.firma.de/api/v1/domains
```

Vollständige Doku: [docs/API.md](docs/API.md)

## Updates

Standardmäßig prüft der Server stündlich auf neue Releases und zeigt einen Banner in der UI. **Keine Auto-Updates** außer aktiviert.

- Manuell: Settings → "Update X.Y.Z installieren"
- Auto: Settings → Auto-Update-Toggle aktivieren

Details: [docs/UPDATE.md](docs/UPDATE.md)

## CLI

Nach Install: `nexredirect <befehl>` auf dem Server.

```
nexredirect status            # Service-Status
nexredirect logs              # Logs streamen
nexredirect update [tag]      # Update auf neueste / Tag
nexredirect version           # current + latest
nexredirect restart           # Service-Restart
nexredirect caddy reload      # Caddy reload
nexredirect caddy show        # Caddyfile dumpen
nexredirect domains           # aktive Domains
nexredirect hits [N]          # letzte N Hits
nexredirect tokens            # API-Token-Liste
nexredirect db                # SQLite-Shell
nexredirect backup [path]     # DB + Caddyfile sichern
nexredirect uninstall         # entfernen (DB bleibt)
nexredirect help
```

## Stack

- Next.js 15 + TypeScript + TailwindCSS + Radix UI + Recharts
- better-sqlite3 (eine Datei in `/var/lib/corex-nexredirect/nexredirect.db`)
- Caddy (Auto-HTTPS, Reverse-Proxy)
- MaxMind GeoLite2-Country (lokal)
- NextAuth Credentials + bcryptjs

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
