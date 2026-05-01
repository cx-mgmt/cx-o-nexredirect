# Architecture

## Komponenten

```
┌──────────────────────────────────────────────────────────────┐
│  Internet                                                     │
└──────────────────┬───────────────────────────────────────────┘
                   │ Port 80 / 443
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  Caddy (auto-HTTPS via Let's Encrypt)                         │
│                                                                │
│  /etc/caddy/Caddyfile (auto-generated)                        │
│  ┌────────────────────────────────────────────────────┐       │
│  │ admin.example.de, server-ip → reverse_proxy :3000 │       │
│  │ alt-firma.de, www.alt-firma.de → reverse_proxy    │       │
│  │   handle_errors { redir https://target.de/ 302 }  │       │
│  │ ...                                                │       │
│  └────────────────────────────────────────────────────┘       │
└──────────────────┬───────────────────────────────────────────┘
                   │ reverse_proxy localhost:3000
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  server.ts (Custom Node Server, läuft via tsx)                │
│                                                                │
│  ① Host-Check                                                  │
│     ├─ Admin-Host (server-IP / base_domain) → Next.js         │
│     ├─ Aktive Redirect-Domain → Hit loggen + 302              │
│     │                          (Sunset → HTML-Notice)         │
│     └─ Unbekannter Host → 404 "Domain not configured"         │
│                                                                │
│  ② Bei Admin-Host:                                             │
│     Next.js handleRequest() — App Router                      │
│     ├─ middleware.ts (Edge): Auth-Check via JWT-Cookie        │
│     ├─ /(app)/* — eingeloggte Routes                          │
│     ├─ /(auth)/login — NextAuth Credentials                   │
│     ├─ /(setup)/setup — First-Run-Wizard                      │
│     ├─ /api/v1/* — Public API (Bearer Token)                  │
│     ├─ /api/* — Admin-API (Session-Cookie)                    │
│     └─ /r/[token] — Internal Report-Page für PDF-Export       │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  better-sqlite3                                                │
│  /var/lib/corex-nexredirect/nexredirect.db                    │
│  Tables: users, domains, domain_groups, hits, settings,       │
│          api_tokens, update_log, audit_log                    │
└──────────────────────────────────────────────────────────────┘
```

## Request-Flow für einen Domain-Hit

1. `GET https://alt-firma.de/foo` → DNS löst auf Server-IP
2. Caddy nimmt an, ACME hat schon Cert für `alt-firma.de`
3. Caddy `reverse_proxy localhost:3000`
4. server.ts `req.headers.host = "alt-firma.de"`
5. `isAdminHost("alt-firma.de")` → false (kein Match auf server_ip / base_domain / localhost)
6. `resolveHost("alt-firma.de")` → Resolved-Eintrag aus In-Memory-Cache (5s TTL)
7. Bot-Filter (`shouldRecord`) prüft Method, UA, Pfad, Browser-Signals, IP-Scan-Detector
8. Wenn echter Hit: `recordHit()` → Buffer (5s batch) → SQLite INSERT
9. Sunset aktiv? → HTML-Notice + `Cache-Control: no-store`
10. Sonst: 302 zum Target mit `no-store` Headers

## Request-Flow für Admin

1. `GET https://admin.example.de/dashboard` → Caddy → server.ts → isAdminHost = true → Next.js
2. `middleware.ts` checkt JWT-Session-Cookie
3. `(app)/layout.tsx` checkt `isSetupComplete()` + `getServerSession()` (force-dynamic)
4. Render Sidebar + Page

## Datenfluss bei Domain-Add

```
UI POST /api/domains
  ├─ Zod-Validation
  ├─ INSERT INTO domains (status='pending')
  └─ Audit-Log

UI POST /api/domains/[id]/verify
  ├─ DNS-Lookup für domain + www-subdomain
  ├─ Vergleich mit getSetting('server_ip')
  ├─ Wenn Match: status='active', verified_at=now
  ├─ invalidateRedirectCache()
  ├─ Caddy: writeCaddyfile() + `caddy reload`
  └─ Response { ok, caddy_reloaded }
```

## Update-Flow

```
UI Click "Update installieren"
  └─ POST /api/update/apply (admin-only)
       └─ exec(`sudo update.sh <tag>`)
            ├─ git checkout tag
            ├─ npm ci
            ├─ Prebuilt .next aus GitHub-Release-Asset (oder npm run build)
            ├─ ln -sf bin/nexredirect /usr/local/bin/
            └─ ( sleep 2 && systemctl restart ) & disown
                 (Detached — script exitet, API kann response zurückgeben)
  └─ UI polled /api/v1/health → window.location.reload()
```

## In-Memory-State

- **Redirect-Cache** (`lib/redirect-resolver.ts`): Map<host, ResolvedRedirect> mit 5s TTL. Invalidiert bei Domain/Group-Mutationen.
- **Hits-Buffer** (`lib/hits.ts`): Array von Pending Hits, alle 5s als Transaction in DB geschrieben.
- **Geo-Reader** (`lib/geo.ts`): MaxMind-mmdb-Reader, lazy load on first lookup.
- **IP-Scan-Tracker** (`lib/hits.ts`): Map<ip_hash, {paths: Set, firstSeen}> mit 30s Window.

Alle in-memory — bei Restart weg, kein Problem (Cache füllt sich neu).

## Sicherheit

- **NextAuth JWT** mit `NEXTAUTH_SECRET` (zufällig generiert beim Install, 30d Session)
- **bcryptjs** für Passwort-Hash (cost 12)
- **API-Tokens** als sha256-Hash in DB; Klartext nur einmalig bei Anlage angezeigt
- **HMAC-signierte Tokens** für PDF-Internal-Access (60s TTL)
- **DSGVO**: IP wird nie im Klartext gespeichert. `sha256(ip + daily_salt)`. Daily-Salt rotiert täglich → keine Re-Identifizierung über Tagesgrenzen.
- **CSRF**: NextAuth handhabt das für Auth-Routes. Admin-Mutations brauchen Session-Cookie. API-Routes brauchen Bearer-Token.
- **Bot-Filter** auch als implizite Schutzschicht gegen Scanner-Probing
- **No exposed admin paths**: alle Mutations brauchen Auth. `/api/v1/*` Bearer.

→ Weiter mit [[Troubleshooting]]
