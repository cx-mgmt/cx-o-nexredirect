import { getDb, hashIp } from "./db";
import { lookupCountry } from "./geo";

// Patterns we don't want polluting analytics
const BOT_UA = /bot|crawl|spider|slurp|curl|wget|httpclient|python-requests|axios|node-fetch|monitor|uptime|pingdom|datadog|prometheus|scanner|fetch|preview|whatsapp|telegrambot|facebookexternalhit|linkedinbot|twitterbot|discordbot|skypeuripreview|mastodon|matrix-bot|preconnect|dnsperf|sentry|newrelic|gtmetrix|lighthouse|headlesschrome|phantomjs|puppeteer|playwright|chrome-lighthouse|go-http-client|java\/|okhttp|libwww|mechanize|nikto|sqlmap|nmap|masscan|zgrab|nuclei|acunetix|netcraft|expanse|censys|shodan|fuzz|burp|arachni|w3af|nikto|wpscan|gobuster|ffuf|dirb|dirbuster/i;

// Known scanner / non-user paths. Treat any match as bot and skip recording.
const SKIP_PATHS = new RegExp([
  // Standard browser/bot probes
  "^/favicon\\.",
  "^/apple-touch-icon",
  "^/robots\\.txt$",
  "^/sitemap[\\w.-]*\\.xml",
  "^/ads\\.txt$",
  "^/browserconfig\\.xml$",
  "^/\\.well-known/",
  // Source-control / config leaks
  "^/\\.git",
  "^/\\.env",
  "^/\\.DS_Store",
  "^/\\.svn",
  "^/\\.hg",
  "^/\\.vscode",
  "^/\\.idea",
  // Common admin / app paths scanners poke
  "^/wp-(admin|login|content|includes|json)",
  "^/xmlrpc\\.php",
  "^/wordpress/",
  "^/admin/",
  "^/administrator/",
  "^/phpmyadmin",
  "^/pma/",
  "^/myadmin",
  "^/mysql/",
  "^/server-status",
  "^/server-info",
  "^/server\\b",
  "^/info\\.php",
  "^/test\\.php",
  "^/login\\.action",
  "^/console/",
  "^/manager/",
  "^/jenkins",
  "^/jolokia",
  "^/actuator",
  "^/telescope",
  "^/horizon",
  "^/debug",
  "^/trace\\.axd",
  "^/elmah\\.axd",
  "^/cgi-bin",
  "^/about$",
  // API / docs probing
  "^/swagger",
  "^/api-docs",
  "^/api/swagger",
  "^/v2/api-docs",
  "^/v3/api-docs",
  "^/v2/_catalog",
  "^/webjars/",
  "^/graphql",
  "^/api/graphql",
  "^/api/gql",
  "^/api/?$",
  // Vite / Next.js source-map probes
  "^/_next/",
  "^/@vite",
  "^/__webpack",
  "^/sourcemaps?/",
  // Exchange / cpanel / WHM enumeration
  "^/ecp/",
  "^/owa/",
  "^/___proxy_subdomain",
  // Random JS/CSS-files scanners reach for (phishing-kit recon)
  "^/(js|assets/js|static)/",
  "^/(css|assets/css)/",
  "^/bot-connect\\.",
  "^/config\\.json$",
  "^/composer\\.(json|lock)",
  "^/package\\.(json|lock)",
  // Path traversal / encoded probes
  "\\.\\./",
  "%2e%2e",
  "/s/[0-9a-f]{20,}",
  // Generic scanner queries
  "rest_route=",
].join("|"), "i");

// In-memory per-IP scan-detector. If the same hashed IP hits >SCAN_THRESHOLD distinct
// paths in SCAN_WINDOW_MS, treat further requests in that window as a scan.
const SCAN_THRESHOLD = 4;
const SCAN_WINDOW_MS = 30_000;
type Tracker = { paths: Set<string>; firstSeen: number };
const ipTracker = new Map<string, Tracker>();

function ipScanCheck(ipHash: string, path: string): boolean {
  const now = Date.now();
  const cur = ipTracker.get(ipHash);
  if (!cur || now - cur.firstSeen > SCAN_WINDOW_MS) {
    ipTracker.set(ipHash, { paths: new Set([path]), firstSeen: now });
    return false;
  }
  cur.paths.add(path);
  if (cur.paths.size > SCAN_THRESHOLD) return true;
  return false;
}

// Periodically prune (best-effort)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const cutoff = Date.now() - SCAN_WINDOW_MS;
    for (const [k, v] of ipTracker.entries()) {
      if (v.firstSeen < cutoff) ipTracker.delete(k);
    }
  }, 60_000).unref?.();
}

export type RequestSignals = {
  accept?: string | null;
  acceptLanguage?: string | null;
  secFetchMode?: string | null;
  secFetchDest?: string | null;
  secFetchSite?: string | null;
};

export function shouldRecord(
  method: string,
  path: string | null,
  userAgent: string | null,
  ipHash?: string,
  signals?: RequestSignals,
): boolean {
  const m = (method || "GET").toUpperCase();
  if (m === "HEAD" || m === "OPTIONS") return false;
  if (path && SKIP_PATHS.test(path)) return false;
  if (userAgent && BOT_UA.test(userAgent)) return false;
  // Heuristic: missing / very short UA is likely a script
  if (!userAgent || userAgent.length < 15) return false;
  // Real browsers always send Mozilla/ prefix; bots that fake it usually still match BOT_UA
  if (!/^Mozilla\//i.test(userAgent)) return false;
  if (ipHash && path && ipScanCheck(ipHash, path)) return false;

  // Browser-signal check: a navigation request from a real browser sends Sec-Fetch-Mode
  // (Chrome/FF/Safari/Edge since 2020) AND Accept-Language. Curl/scanners almost never send both.
  // For redirect-server use-case a "real" hit is always a top-level navigation, so this is
  // safe to require.
  if (signals) {
    const hasSecFetch = !!signals.secFetchMode;
    const hasAcceptLang = !!signals.acceptLanguage;
    const acceptHtml = !!signals.accept && /text\/html/i.test(signals.accept);
    // Need at least 2 of 3 to pass (real browsers send all 3; old browsers may miss Sec-Fetch)
    const score = (hasSecFetch ? 1 : 0) + (hasAcceptLang ? 1 : 0) + (acceptHtml ? 1 : 0);
    if (score < 2) return false;
    // Sec-Fetch-Dest should be document/empty for navigation; reject script/image probes
    if (signals.secFetchDest && !/^(document|empty|iframe)$/i.test(signals.secFetchDest)) return false;
  }
  return true;
}

type PendingHit = {
  domain_id: number;
  ts: number;
  ip_hash: string;
  country: string | null;
  user_agent: string | null;
  referer: string | null;
  path: string | null;
};

const buffer: PendingHit[] = [];
let flushTimer: NodeJS.Timeout | null = null;

function flush() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);
  try {
    const db = getDb();
    const stmt = db.prepare(
      "INSERT INTO hits (domain_id, ts, ip_hash, country, user_agent, referer, path) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    db.transaction(() => {
      for (const h of batch) {
        stmt.run(h.domain_id, h.ts, h.ip_hash, h.country, h.user_agent, h.referer, h.path);
      }
    })();
  } catch (e) {
    console.error("[hits] flush failed", e);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, 5000);
}

export async function recordHit(input: {
  domain_id: number;
  ip: string;
  user_agent: string | null;
  referer: string | null;
  path: string | null;
}) {
  const country = await lookupCountry(input.ip).catch(() => null);
  buffer.push({
    domain_id: input.domain_id,
    ts: Date.now(),
    ip_hash: hashIp(input.ip),
    country,
    user_agent: input.user_agent ? input.user_agent.slice(0, 500) : null,
    referer: input.referer ? input.referer.slice(0, 500) : null,
    path: input.path ? input.path.slice(0, 500) : null,
  });
  if (buffer.length >= 100) flush();
  else scheduleFlush();
}

export function flushHitsSync() {
  flush();
}
