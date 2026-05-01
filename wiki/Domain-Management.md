# Domain Management

## Domain hinzufügen

`/domains/new` öffnen. 3 Schritte:

1. **Domain & Ziel**: Domain-Name + Ziel-URL (oder Gruppe), Status-Code (302 empfohlen), Pfad-Preserve, www-Subdomain
2. **DNS-Records anzeigen**: A-Records eintragen wie angezeigt
3. **Validieren**: Klick → Server prüft → bei Erfolg ist die Domain sofort aktiv

## Status-Code 301 vs 302

**302 (Default)**: Browser cached den Redirect nicht. Jeder Aufruf hittet den Server, Analytics zählt sauber. Dafür minimaler SEO-Verlust.

**301**: Browser cached permanent. Folge-Aufrufe gehen direkt zum Ziel ohne deinen Server zu sehen — Hit-Counter bleibt bei 1, egal wie oft. NexRedirect setzt zwar `Cache-Control: no-store`, viele Browser ignorieren das aber bei 301.

**Empfehlung**: 302 außer bei expliziter SEO-Strategie.

## Pfad-Preserve

`alt-domain.de/foo/bar` → wenn aktiv: `https://ziel.de/foo/bar`. Wenn aus: alle Pfade landen auf `https://ziel.de/`.

Bei Domains die nur als Vanity-Redirect dienen → Aus. Bei echten Migrationen → An.

## www-Subdomain

Aktiviert hinzufügen: `www.example.de` zeigt aufs gleiche Ziel. Caddy holt dafür ein zweites Cert.

## Gruppen

Mehrere Domains zum gleichen Ziel = Gruppe.

`/groups` → "Neue Gruppe" → Name + Ziel-URL. Beim Domain-Anlegen unter "Ziel" → "Gruppe" wählen statt Einzel-URL. Vorteil: Ziel-URL einmal ändern → alle Domains in der Gruppe folgen.

Edit-Funktion über Bleistift-Icon. Löschen blockiert solange Domains die Gruppe nutzen.

## Bulk-Aktionen

Auf `/domains` Checkbox-Spalte links. Auswahl löst Selection-Bar oben aus:

- **Löschen** mehrere Domains (Bestätigung zeigt Hit-Count)
- **Sunset-Hinweis** für N Domains gleichzeitig konfigurieren (siehe [[Sunset Pages]])

## Domain bearbeiten

`/domains/<id>` → "Konfiguration"-Card hat ein inline Edit-Form: Ziel, Code, Gruppe, Pfad-Preserve, www. Speichern triggert automatisch Caddy-Reload.

## Domain löschen

Detail-Page → "Aktionen" → "Domain löschen". Confirm-Dialog warnt wie viele Hits mitgelöscht werden. Auch via [[CLI]]: `nexredirect db` und SQL.

→ Weiter mit [[Sunset Pages]]
