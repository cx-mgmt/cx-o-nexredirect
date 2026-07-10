# cx-nexredirect

> NexRedirect - Self-hosted Domain-Redirect-Server

**Stack:** Next.js · Custom-Server (Node/tsx)

## Entwicklung

```bash
npm install
npm run dev        # http://localhost:3000
```

## Branch-Modell

| Branch    | Zweck                | Deploy                      |
| --------- | -------------------- | --------------------------- |
| `prod`    | Production (Default) | Auto → Coolify (Production) |
| `preview` | Staging / Preview    | Auto → Coolify (Preview)    |
| `dev`     | Integration          | nur CI + Image-Build        |
| `test`    | Experimente          | nur CI + Image-Build        |

## Deploy

GitHub Actions baut das Docker-Image und pusht es nach
`ghcr.io/cx-mgmt/cx-nexredirect:<branch>`. Coolify zieht das fertige Image
(kein Build am Server). Siehe `.github/workflows/build-deploy.yml`.

## Datenbank

SQLite (dateibasiert). Persistenz über ein Volume auf `/app/data` in Coolify.

## Umgebungsvariablen

Sensible Werte werden als GitHub-Environment-Secrets bzw. in Coolify gesetzt —
niemals committen.

## Sicherheit

Siehe [SECURITY.md](SECURITY.md). Dependabot + Trivy sind aktiv.
