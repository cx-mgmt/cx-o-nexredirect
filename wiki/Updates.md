# Updates

NexRedirect prüft alle 60 Minuten gegen die GitHub-Releases-API auf neue Versionen. **Keine Auto-Updates** außer aktiviert.

## Update-Verhalten

| Setting | Verhalten |
|---|---|
| Default | Stündlicher Check, Banner in der UI bei neuem Release. Nichts wird ohne Klick installiert. |
| `update_auto = true` | Bei jedem Check wird verfügbares Update sofort installiert. |
| `update_include_prereleases = true` | Auch Pre-Releases als Update angezeigt. |

## Manuell aktualisieren

**UI:**

1. Banner oben oder Settings → "Update v0.1.X installieren" klicken
2. Bestätigen
3. UI zeigt Spinner, polled `/api/v1/health`, lädt Seite neu sobald Server zurück

**CLI:**

```bash
sudo nexredirect update              # auf neueste, skip wenn schon aktuell
sudo nexredirect update v0.1.10      # auf bestimmten Tag (auch downgrade)
sudo nexredirect update -f           # erzwingen auch wenn gleiche Version
```

## Update-Mechanik

1. `update.sh` prüft latest Release-Tag (oder nimmt übergebenen Tag)
2. Skip wenn current === latest und kein `-f`
3. `git fetch --tags && git checkout <tag>` als Service-User
4. `npm ci`
5. **Prebuilt `.next`-Tarball** aus Release-Asset ziehen — spart ~25s gegenüber lokal bauen
6. Falls kein Asset (oder Download fehlschlägt): `npm run build` als Fallback
7. CLI-Symlink + Permissions aktualisieren
8. **Detached restart** in 2s (Hauptscript exitet zuerst sauber → API kann response zurückgeben → DANN restart)

## Auto-Update aktivieren

Settings → Toggle "Auto-Update aktivieren". Ab dann wird bei jedem stündlichen Check ein verfügbares Update direkt installiert.

**Empfehlung**: Nur in Test-Umgebungen. In Prod manuell prüfen, Release-Notes lesen.

## Rollback

```bash
sudo nexredirect update v0.1.10   # auf Vorgänger-Version
```

`update.sh` läuft `git checkout <tag>` egal ob vorwärts oder rückwärts. Schema-Migrationen sind additiv (`ALTER TABLE ADD COLUMN`) — Downgrade fragmenten ungenutzte Spalten ignorieren.

Falls Schema-Inkompatibilität: vorher Backup, ggf. DB händisch downgraden.

## Schema-Migrationen

Beim Start:

1. `ensureSchema(db)` legt fehlende Tabellen idempotent an (`CREATE TABLE IF NOT EXISTS`)
2. `runMigrations(db)` läuft definierte Schritte (Settings-Flag-basiert + Schema-Check)

Aktuelle Migrationen:

- `m_301_to_302`: alle existierenden 301-Codes auf 302 ändern (Browser-Cache-Fix)
- `sunset_config`-Spalte: Self-healing — prüft via `PRAGMA table_info` ob Spalte existiert, fügt hinzu wenn nicht

## Update-Log

Jeder Update-Versuch wird in der `update_log`-Tabelle protokolliert:

```sql
SELECT ts, from_version, to_version, status FROM update_log ORDER BY ts DESC LIMIT 10;
```

Status: `success` oder `failed` (Log-Auszug in der `log`-Spalte).

→ Weiter mit [[Architecture]]
