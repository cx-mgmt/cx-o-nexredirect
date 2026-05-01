# Sunset Pages

Statt sofortigem Redirect kann eine **Hinweisseite** kommen — schlichte weiße Seite mit Custom-Text und einem "Weiter"-Button. Klickt der User → echter Redirect.

## Wann brauchst du das?

- **Domain wird abgeschaltet**: "Diese Domain wird zum 31.12.2026 abgeschaltet. Bitte verwende ab sofort https://neue-domain.de"
- **Marken-Migration**: Hinweis dass die Firma umfirmiert hat
- **Information** über kommenden Besitzerwechsel

## Konfiguration per Domain

Domain-Detail-Page → Card "Abschaltungs-Hinweis" → Toggle aktivieren:

| Feld | Beispiel |
|---|---|
| Titel | Diese Domain wird abgeschaltet |
| Nachricht | Die Domain alt-firma.de wird zum 31.12.2026 abgeschaltet. Bitte verwenden Sie ab sofort https://neue-firma.de |
| Button-Text | Weiter |
| Abschaltdatum | 31.12.2026 _(optional, nur Anzeige)_ |

Speichern. Beim nächsten Aufruf der Domain bekommt der User die Notice statt Redirect. Klick auf "Weiter" → `?nr_continue=1` → echter Redirect.

## Bulk-Konfiguration

Auf `/domains` mehrere Domains markieren → Selection-Bar → "Sunset-Hinweis" → Form ausfüllen → "Auf N anwenden". Setzt für alle markierten Domains die gleiche Konfiguration.

Zum Deaktivieren für mehrere: Checkbox "Aktivieren" im Bulk-Dialog ausschalten und anwenden.

## Implementierung

Custom Server (`server.ts`) prüft beim Resolve eines Hosts:

1. Wenn Domain Sunset hat UND Request **kein** `?nr_continue=1` → HTML-Notice mit `Cache-Control: no-store`
2. Wenn `?nr_continue=1` → ganz normaler 302/301 zum Target

Hit wird beim ERSTEN Request gezählt (Notice-Render). Continue-Click zählt NICHT als zweiter Hit (würde sonst doppeln).

HTML-Page ist in [`lib/sunset-html.ts`](https://github.com/CoreXManagement/CoreX-NexRedirect/blob/main/lib/sunset-html.ts) — schwarz auf weiß, kein JS, kein externes Asset, kein Tracking. Funktioniert auch ohne JS-Browser.

## Wichtige Hinweise

- Sunset-Page wird **nicht** vom Browser gecacht (`Cache-Control: no-store`)
- Sunset-Page ist `noindex,nofollow` für Suchmaschinen
- Robots.txt etc. werden NICHT durch die Notice geleitet, gehen direkt zum Target
- Bei aktivem Sunset wird der Caddy-Fallback (bei App-Down: Direkt-Redirect via `handle_errors`) trotzdem ausgelöst — Notice nur wenn App läuft

→ Weiter mit [[Analytics & Reports]]
