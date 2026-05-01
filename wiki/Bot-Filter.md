# Bot Filter

NexRedirect zählt nur "echte" Besucher — Scanner, Crawler und Monitoring-Tools werden serverseitig herausgefiltert. Kombination mehrerer Heuristiken in [`lib/hits.ts`](https://github.com/CoreXManagement/CoreX-NexRedirect/blob/main/lib/hits.ts):

## 1. HTTP-Method

`HEAD` und `OPTIONS` werden nie gezählt (Pre-Flight, Health-Checks).

## 2. Pfad-Pattern

Bekannte Scanner-Pfade werden ignoriert. Auszug:

```
/.env*  /.git*  /.DS_Store  /.vscode  /.svn  /.hg  /.idea
/wp-(admin|login|content|includes|json)  /xmlrpc.php  /wordpress/
/admin/  /administrator/  /phpmyadmin  /pma/  /myadmin
/server-status  /server-info  /info.php  /test.php
/login.action  /console/  /manager/  /jenkins  /jolokia
/actuator  /telescope  /horizon  /debug  /trace.axd  /elmah.axd
/cgi-bin  /about
/swagger*  /api-docs*  /api/swagger  /v[23]/api-docs  /v2/_catalog
/webjars/  /graphql*  /api/gql  /api/?$
/_next/  /@vite  /__webpack
/ecp/  /owa/  /___proxy_subdomain
/(js|assets/js|static)/  /(css|assets/css)/
/bot-connect.*  /config.json  /composer.*  /package.*
\.\./  %2e%2e  /s/[0-9a-f]{20,}
rest_route=
/favicon.*  /apple-touch-icon  /robots.txt  /sitemap*  /ads.txt
/.well-known/  /browserconfig.xml
```

Komplett-Liste in `lib/hits.ts`.

## 3. User-Agent-Pattern

Bot-Keywords werden gematched:

```
bot, crawl, spider, slurp, curl, wget, httpclient, python-requests,
axios, node-fetch, monitor, uptime, pingdom, datadog, prometheus,
scanner, fetch, preview, whatsapp, telegrambot, facebookexternalhit,
linkedinbot, twitterbot, discordbot, skypeuripreview, mastodon,
matrix-bot, preconnect, dnsperf, sentry, newrelic, gtmetrix,
lighthouse, headlesschrome, phantomjs, puppeteer, playwright,
go-http-client, java/, okhttp, libwww, mechanize, nikto, sqlmap,
nmap, masscan, zgrab, nuclei, acunetix, netcraft, expanse, censys,
shodan, fuzz, burp, arachni, w3af, wpscan, gobuster, ffuf, dirb,
dirbuster
```

Plus:
- UA muss `Mozilla/` Prefix haben (echte Browser; Bots ohne Mozilla-Faked werden auch via UA-Keywords gefangen)
- UA muss mindestens 15 Zeichen lang sein

## 4. Browser-Signal-Heuristik

Echte Browser senden bei jeder Top-Level-Navigation:

- **`Sec-Fetch-Mode`** Header (Chrome/FF/Safari/Edge seit ~2020)
- **`Accept-Language`** Header (jeder Browser hat eine Spracheinstellung)
- **`Accept`** mit `text/html` (Browser fragen explizit nach HTML; Scanner senden `*/*`)

**Mindestens 2 von 3** müssen gesetzt sein. Plus: `Sec-Fetch-Dest` muss `document` / `empty` / `iframe` sein (filtert Image- / Script-Probes).

Das ist der wichtigste Filter — Scanner mit gefälschtem `Mozilla/5.0`-UA fallen hier durch.

## 5. Per-IP Scan-Detektor

In-Memory: gleiche IP-Hash, ≥5 verschiedene Pfade in 30s = Scanner. Alle weiteren Hits dieser IP im Zeitfenster werden verworfen.

## Ergebnis

Bei einem typischen Vanity-Redirect-Server:

- Vorher: ~80% der Hits sind Bots (vor allem nach DNS-Aktivierung kommen Scanner-Wellen)
- Nachher: <5% (vereinzelte Lighthouse / Pingdom etc.)

## False-Positives anzeigen

Bot-Hits werden gar nicht gespeichert — wenn du sie sehen willst, müsstest du temporär die Filter ausschalten. Es gibt keinen "ignored hits"-Counter.

Wenn ein Browser fälschlicherweise ausgefiltert wird (uralter Browser ohne Sec-Fetch?): bitte im GitHub-Issue melden mit User-Agent + Headers.

→ Weiter mit [[CLI]]
