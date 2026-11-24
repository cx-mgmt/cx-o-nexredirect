// Custom Node server. Intercepts requests by Host header.
// - Host matches active redirect-domain → log hit + 301/302 + end (skip Next.js)
// - Else → delegate to Next.js (admin UI / API)
//
// Run via: tsx server.ts

import http from "http";
import { parse } from "url";
import next from "next";
import { resolveHost, isAdminHost } from "./lib/redirect-resolver";
import { recordHit, shouldRecord } from "./lib/hits";
import { renderSunsetPage } from "./lib/sunset-html";
import { isBlocked } from "./lib/blocklist";
import { startJobs } from "./lib/jobs";
import { hashIp, getSetting } from "./lib/db";
import { parseAllowlist, isIpAllowed } from "./lib/ip-allowlist";
import { authSecret } from "./lib/auth-secret";
import { sanitizeInboundHeaders } from "./lib/client-ip";
import { buildRedirectLocation, redirectTargetAllowed } from "./lib/safe-url";
import { SECURITY_HEADERS } from "./lib/security-headers";

authSecret();

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOSTNAME || "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

app.prepare().then(() => {
  startJobs();
  const server = http.createServer(async (req, res) => {
    try {
      const clientIp = sanitizeInboundHeaders(req.headers, req.socket.remoteAddress);
      const host = (req.headers.host || "").split(":")[0].toLowerCase();
      const parsedUrl = parse(req.url || "/", true);
      const requestPath = parsedUrl.pathname || "/";
      if (requestPath === "/.git" || requestPath.startsWith("/.git/")) {
        res.writeHead(404, { "Content-Type": "text/plain", ...SECURITY_HEADERS });
        res.end("Not found");
        return;
      }

      if (host && !isAdminHost(host)) {
        const resolved = resolveHost(host);
        if (resolved) {
          const ip = clientIp;
          const ua = (req.headers["user-agent"] as string) || null;
          // Hash IP early so we can use it for the scan-detector check
          const ipHash = hashIp(ip);
          // Persistent blocklist: drop without recording or redirecting
          if (isBlocked(ipHash)) {
            res.writeHead(403, { "Content-Type": "text/plain", ...SECURITY_HEADERS });
            res.end("Blocked");
            return;
          }
          const signals = {
            accept: (req.headers["accept"] as string) || null,
            acceptLanguage: (req.headers["accept-language"] as string) || null,
            secFetchMode: (req.headers["sec-fetch-mode"] as string) || null,
            secFetchDest: (req.headers["sec-fetch-dest"] as string) || null,
            secFetchSite: (req.headers["sec-fetch-site"] as string) || null,
          };
          if (shouldRecord(req.method || "GET", req.url || "/", ua, ipHash, signals)) {
            recordHit({
              domain_id: resolved.domain_id,
              ip,
              user_agent: ua,
              referer: (req.headers["referer"] as string) || null,
              path: req.url || null,
            }).catch(() => {});
          }

          const reqPath = req.url || "/";
          const location = buildRedirectLocation({
            targetUrl: resolved.target_url,
            catchallUrl: resolved.catchall_url,
            preservePath: resolved.preserve_path,
            pathname: parsedUrl.pathname,
            path: parsedUrl.path,
          });
          if (!location || !(await redirectTargetAllowed(location))) {
            res.writeHead(404, { "Content-Type": "text/plain", ...SECURITY_HEADERS });
            res.end("Redirect target rejected");
            return;
          }

          // Sunset notice: serve interstitial unless user clicked "Weiter" (?nr_continue=1)
          const isContinue = parsedUrl.query?.nr_continue === "1";
          if (resolved.sunset && !isContinue) {
            const html = renderSunsetPage({
              domain: resolved.domain,
              target: location,
              preservePath: resolved.preserve_path,
              reqPath,
              cfg: resolved.sunset,
            });
            res.writeHead(200, {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
              ...SECURITY_HEADERS,
            });
            res.end(html);
            return;
          }

          res.writeHead(resolved.redirect_code || 302, {
            Location: location,
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            Pragma: "no-cache",
            Expires: "0",
            ...SECURITY_HEADERS,
          });
          res.end();
          return;
        }

        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8", ...SECURITY_HEADERS });
        res.end(
          `<!doctype html><html><head><title>Domain not configured</title><style>body{background:#0a0c10;color:#e5e7eb;font-family:ui-monospace,monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}</style></head><body><div><h1>Domain nicht konfiguriert</h1><p>Diese Domain ist auf diesem Server nicht eingerichtet.</p></div></body></html>`
        );
        return;
      }

      // IP allowlist for admin UI (skips /api/v1 public API and loopback)
      const reqPath = parsedUrl.pathname || "/";
      if (!reqPath.startsWith("/api/v1")) {
        const allowlist = parseAllowlist(getSetting("admin_ip_allowlist"));
        if (allowlist.length > 0) {
          const isLoopback = clientIp === "127.0.0.1";
          if (!isLoopback && !isIpAllowed(clientIp, allowlist)) {
            res.writeHead(403, { "Content-Type": "text/html; charset=utf-8", ...SECURITY_HEADERS });
            res.end(
              `<!doctype html><html><head><title>403 Forbidden</title><style>body{background:#0a0c10;color:#e5e7eb;font-family:ui-monospace,monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}</style></head><body><div style="text-align:center"><h1 style="color:#f87171">403 Forbidden</h1><p>Deine IP-Adresse (<code>${escapeHtml(clientIp)}</code>) ist nicht in der Zugriffsliste.</p></div></body></html>`
            );
            return;
          }
        }
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
