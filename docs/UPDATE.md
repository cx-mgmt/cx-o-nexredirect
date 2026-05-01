# Updates

NexRedirect prüft alle 60 Minuten gegen die GitHub-Releases-API auf neue Versionen. **Keine Auto-Updates** außer aktiviert.

## Update-Verhalten

| Setting | Verhalten |
|---------|-----------|
| (Default) | Stündlicher Check, Banner in der UI bei verfügbarem Update. Nichts wird ohne Klick installiert. |
| `update_auto = true` | Bei jedem Check wird ein verfügbares Update sofort installiert. |
| `update_include_prereleases = true` | Auch Pre-Releases werden als Update angezeigt. |

## Manuell aktualisieren

In der UI:

1. **Einstellungen** → "Update X.Y.Z installieren" klicken
2. Bestätigen
3. Server fährt herunter, zieht Tag, baut, startet neu (Admin-UI ~5–10s down)
4. Redirects bleiben über Caddy aktiv (Caddy-Block enthält statisches Fallback-`redir`)

Auf der Konsole:
```bash
sudo /opt/corex-nexredirect/scripts/update.sh v0.2.0
```

## Auto-Update aktivieren

**Einstellungen → "Auto-Update aktivieren"** klicken. Ab dann wird bei jedem stündlichen Check ein verfügbares Update direkt installiert. UI-Banner erscheint nicht mehr (oder kurz).

Empfehlung: Auto-Update nur in Test-Umgebungen, in Prod manuell prüfen.

## Rollback

```bash
cd /opt/corex-nexredirect
sudo -u nexredirect git tag --list | sort -V
sudo /opt/corex-nexredirect/scripts/update.sh v0.1.0   # Vorgänger-Tag
```

Der Update-Skript ruft `git checkout <tag>` und rebuilt — daher gleich für Forward- und Rollback-Updates.

## Schema-Migrationen

`ensureSchema` in `lib/db.ts` legt fehlende Tabellen/Indizes idempotent an — `CREATE TABLE IF NOT EXISTS` für jede Tabelle. Reine additive Migrationen sind damit automatisch.

Für **destruktive** Migrationen (Spalten umbenennen, droppen): manuelles SQL vor dem Update einspielen, Schritte werden im Release-Note dokumentiert.

## Update-Log

Jeder Update-Versuch wird in der `update_log`-Tabelle protokolliert:

```sql
SELECT ts, from_version, to_version, status FROM update_log ORDER BY ts DESC LIMIT 10;
```

Status: `success` oder `failed` (mit Log-Auszug in der `log`-Spalte).
