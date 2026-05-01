# Analytics & Reports

## Was wird getrackt?

Pro echtem Hit (siehe [[Bot Filter]]):

- Zeitstempel (ms)
- Domain-ID
- Land (ISO-2, falls GeoLite2 installiert)
- IP-Hash (sha256(ip + täglicher Salt) — DSGVO, kein Klartext)
- User-Agent (max 500 Zeichen)
- Referer (max 500 Zeichen)
- Pfad (max 500 Zeichen)

## Dashboard `/dashboard`

- Total / Aktiv / Wartend Domains
- Hits 24h + Eindeutige Besucher
- Top-10-Domains-Bar
- Daily-Hits-Line letzte 30 Tage

## Analytics `/analytics`

- Daily-Line letzte 30 Tage
- Top 10 Domains
- Top Länder (Pie)
- Tote Domains (aktiv aber 0 Hits / 90 Tage)

## Domain-Detail

`/domains/<id>` zeigt:

- Hits 24h / 30 Tage / Gesamt
- Eindeutige Besucher (30d, gesamt)
- Daily-Line der letzten 30 Tage **dieser Domain**
- DNS-Records-Übersicht (live, refreshbar)
- Sunset-Editor

## PDF-Report-Export

`/analytics` → "PDF Export" Button:

- 3 Vorlagen: **Minimal** / **Basic** / **Detailliert**
- Titel + Zeitraum (1–365 Tage) frei wählbar
- Sektionen einzeln an/aus: Zusammenfassung, Daily-Chart, Top-Domains, Geo, Tote, Per-Domain-Detail, Letzte 200 Hits

Server-side Generation via headless Chromium (puppeteer-core). Direkt-Download als PDF. A4 Hochformat, NexRedirect-Branding, sauberes Page-Break-Verhalten.

Token-basierter Internal-Access (60s gültig, HMAC-signed) — Report-URL ist nicht öffentlich abrufbar.

## CSV-Export

- `/domains` → "CSV" lädt komplette Domain-Liste mit Hit-Counts
- `/analytics` → "Hits CSV" lädt letzte 30 Tage Hits (max 100k Zeilen)

CSV ist UTF-8 mit Komma-Trenner, RFC 4180-konform (Quotes für Sonderzeichen).

## Audit-Log `/audit`

500 letzte administrative Aktionen mit Zeit, Benutzer-Email, Aktion, Ziel, Details:

- domain.create / .update / .delete / .verify / .bulk_delete
- group.create / .update / .delete
- sunset.bulk
- (kann erweitert werden)

## Eindeutige Besucher

`COUNT(DISTINCT ip_hash)` über den Zeitraum. **Wichtig**: IP-Hash rotiert täglich (DSGVO-Anforderung). Gleicher User der heute und morgen kommt zählt als 2 verschiedene Besucher.

Innerhalb eines Tages ist die Zählung präzise. Über mehrere Tage ist die Besucher-Zahl eine **Obergrenze** (überschätzt).

→ Weiter mit [[Bot Filter]]
