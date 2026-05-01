// Custom Node server. Intercepts requests by Host header.
// - Host matches active redirect-domain → log hit + 301/302 + end (skip Next.js)
// - Else → delegate to Next.js (admin UI / API)
//
// Run via: tsx server.ts

import http from "http";
import { parse } from "url";
import next from "next";
import { resolveHost, isAdminHost } from "./lib/redirect-resolver";
import { recordHit } from "./lib/hits";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOSTNAME || "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = http.createServer(async (req, res) => {
    try {
      const host = (req.headers.host || "").split(":")[0].toLowerCase();
      const parsedUrl = parse(req.url || "/", true);

      if (host && !isAdminHost(host)) {
        const resolved = resolveHost(host);
        if (resolved) {
          const ip =
            ((req.headers["x-forwarded-for"] || "") as string).split(",")[0].trim() ||
            req.socket.remoteAddress ||
            "unknown";
          recordHit({
            domain_id: resolved.domain_id,
            ip,
            user_agent: (req.headers["user-agent"] as string) || null,
            referer: (req.headers["referer"] as string) || null,
            path: req.url || null,
          }).catch(() => {});

          const target = resolved.preserve_path
            ? resolved.target_url + (parsedUrl.path || "")
            : resolved.target_url;
          res.writeHead(resolved.redirect_code || 301, { Location: target });
          res.end();
          return;
        }

        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          `<!doctype html><html><head><title>Domain not configured</title><style>body{background:#0a0c10;color:#e5e7eb;font-family:ui-monospace,monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}</style></head><body><div><h1>Domain nicht konfiguriert</h1><p>Diese Domain ist auf diesem Server nicht eingerichtet.</p></div></body></html>`
        );
        return;
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("[server] error", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  server.listen(port, hostname, () => {
    console.log(`> CoreX NexRedirect on http://${hostname}:${port} (${dev ? "dev" : "prod"})`);
  });
}).catch((err) => {
  console.error("Failed to start Next.js", err);
  process.exit(1);
});
