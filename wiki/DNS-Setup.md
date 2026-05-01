# DNS Setup

Damit eine Domain auf NexRedirect zeigt, müssen DNS-Records auf die Server-IP zeigen.

## Records

Beim Hinzufügen einer Domain im UI bekommst du genau angezeigt was einzutragen ist. Standard:

| Type | Name | Value |
|---|---|---|
| A | @ | `<server-ipv4>` |
| AAAA | @ | `<server-ipv6>` _(optional)_ |
| A | www | `<server-ipv4>` |

`@` steht für die Root-Domain. Manche DNS-Provider erwarten stattdessen den vollen Domain-Namen oder ein leeres Feld — egal, alle drei Schreibweisen meinen dasselbe.

## Validierung

Nach dem Eintragen klick im UI auf **Prüfen**. Server fragt selbst per `dns.resolve()` ab und vergleicht mit der eigenen IP. Bei Match → Domain wird auf `active` gestellt → Caddy reload → Auto-HTTPS-Cert via Let's Encrypt.

DNS-Propagation kann ein paar Minuten dauern. Nochmal prüfen → meistens da.

## DNS-Records-Übersicht

In der Domain-Detail-Page gibt's eine Card "DNS-Records" — listet **alle** Records die für diese Domain veröffentlicht sind: A, AAAA, CNAME, MX, NS, TXT, SOA, CAA. A/AAAA-Werte die auf den Server zeigen werden grün markiert.

Refresh-Button löst neue Abfrage aus.

## Auto-HTTPS

Sobald eine Domain `active` ist, holt Caddy automatisch ein Let's-Encrypt-Cert. Erste HTTPS-Anfrage kann ~10s dauern, danach gecacht.

Voraussetzung: Server muss aus dem Internet auf Port 80 erreichbar sein (für ACME-Challenge).

## Häufige Probleme

**DNS validiert nicht**: A-Record zeigt auf falsche IP, oder TTL noch nicht abgelaufen. `dig +short example.de` und `dig +short example.de @8.8.8.8` vergleichen.

**HTTPS funktioniert nicht trotz active**: Caddy braucht eingehend Port 80 frei. Firewall prüfen. Logs: `nexredirect logs | grep -i caddy` oder `journalctl -u caddy -n 50`.

**Cert-Renewal-Errors**: Let's Encrypt Rate-Limit (50/Woche pro Domain). Bei vielen Subdomains: Wildcard-Cert nötig — wird aktuell nicht unterstützt, jede Subdomain braucht eigenen Cert.

→ Weiter mit [[Domain Management]]
