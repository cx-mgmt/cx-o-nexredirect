# API

REST-API unter `/api/v1/*`. Versioniert und stabil. JSON-only.

## Auth

Tokens in der UI unter **Einstellungen → API-Tokens** erstellen. Token wird nur einmalig angezeigt, danach nur als sha256-Hash in der DB.

Format: `nrx_<64-hex>`. Im Header senden:

```
Authorization: Bearer nrx_<your-token>
```

## Scopes

| Scope | Zugriff |
|---|---|
| `read:domains` | Domains lesen |
| `write:domains` | Domains anlegen / löschen |
| `read:analytics` | Aggregierte Statistiken |
| `read:hits` | Roh-Hits (nur ip_hash, kein Klartext-IP) |

Fehler-Format:

```json
{ "error": "forbidden", "code": "missing_scope", "required": "read:domains" }
```

## Endpoints

### `GET /api/v1/health`

Liveness-Check. Kein Token nötig.

```bash
curl https://admin.firma.de/api/v1/health
# {"ok":true,"ts":1714500000000}
```

### `GET /api/v1/version`

Aktuelle Version + Update-Status. Kein Token nötig.

```json
{
  "current": "0.1.19",
  "latest": "0.1.19",
  "update_available": false,
  "auto_update": false
}
```

### `GET /api/v1/domains`

Scope: `read:domains`

```json
{
  "domains": [
    {
      "id": 1, "domain": "alt-firma.de", "status": "active",
      "target_url": "https://www.firma.de", "redirect_code": 302,
      "preserve_path": 1, "include_www": 1,
      "total_hits": 142, "last_hit": 1714499000000
    }
  ]
}
```

### `POST /api/v1/domains`

Scope: `write:domains`

Body:

```json
{
  "domain": "alt-firma.de",
  "target_url": "https://www.firma.de",
  "redirect_code": 302,
  "preserve_path": true,
  "include_www": true
}
```

Response (`201`):

```json
{
  "domain": { "id": 5, "status": "pending", ... },
  "dns_records": [
    { "type": "A", "name": "alt-firma.de", "value": "203.0.113.42" },
    { "type": "A", "name": "www.alt-firma.de", "value": "203.0.113.42" }
  ]
}
```

### `GET /api/v1/domains/:id`

Scope: `read:domains`

### `DELETE /api/v1/domains/:id`

Scope: `write:domains`

### `GET /api/v1/domains/:id/stats?days=30`

Scope: `read:analytics`

```json
{
  "domain_id": 1, "days": 30, "total": 412,
  "daily": [{"day":"2026-04-01","hits":12}, ...],
  "by_country": [{"country":"DE","hits":380}, ...]
}
```

### `GET /api/v1/analytics/summary?days=30`

Scope: `read:analytics`

```json
{
  "days": 30, "total": 12480,
  "daily": [...],
  "top": [{"id":1,"domain":"alt-firma.de","hits":412}, ...],
  "by_country": [...]
}
```

### `GET /api/v1/hits?domain_id=1&limit=100`

Scope: `read:hits`

```json
{
  "hits": [
    {
      "id": 9001, "domain_id": 1, "ts": 1714499000000,
      "ip_hash": "9f4a...", "country": "DE",
      "user_agent": "Mozilla/5.0 ...", "referer": null, "path": "/"
    }
  ]
}
```

`ip_hash` = `sha256(ip + täglicher Salt)`. Kein Klartext-IP wird gespeichert.

## Versionierung

`/api/v1` ist stabil. Breaking-Changes bekommen `/api/v2`. Deprecation-Hinweise im `Sunset`-Header.

## Rate-Limits

Aktuell kein hartes Limit. Empfehlung: max. 60 req/min pro Token.

## Beispiele

**Uptime-Check eines Tokens:**

```bash
curl -fsS -H "Authorization: Bearer $NRX" https://admin.firma.de/api/v1/health || echo "DOWN"
```

**Liste tote Domains (0 Hits / 90d):**

```bash
curl -s -H "Authorization: Bearer $NRX" \
  "https://admin.firma.de/api/v1/analytics/summary?days=90" \
  | jq '.top | map(select(.hits == 0))'
```

**Domain anlegen + DNS-Records anzeigen:**

```bash
curl -X POST -H "Authorization: Bearer $NRX" -H "Content-Type: application/json" \
  -d '{"domain":"shop.alt.de","target_url":"https://shop.firma.de"}' \
  https://admin.firma.de/api/v1/domains | jq '.dns_records'
```

→ Weiter mit [[Updates]]
