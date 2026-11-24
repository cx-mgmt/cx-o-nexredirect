import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const BLOCKED = new BlockList();
BLOCKED.addSubnet("0.0.0.0", 8, "ipv4");
BLOCKED.addSubnet("10.0.0.0", 8, "ipv4");
BLOCKED.addSubnet("100.64.0.0", 10, "ipv4");
BLOCKED.addSubnet("127.0.0.0", 8, "ipv4");
BLOCKED.addSubnet("169.254.0.0", 16, "ipv4");
BLOCKED.addSubnet("172.16.0.0", 12, "ipv4");
BLOCKED.addSubnet("192.0.0.0", 24, "ipv4");
BLOCKED.addSubnet("192.168.0.0", 16, "ipv4");
BLOCKED.addSubnet("198.18.0.0", 15, "ipv4");
BLOCKED.addSubnet("224.0.0.0", 4, "ipv4");
BLOCKED.addRange("240.0.0.0", "255.255.255.255", "ipv4");
BLOCKED.addAddress("::", "ipv6");
BLOCKED.addAddress("::1", "ipv6");
BLOCKED.addSubnet("fc00::", 7, "ipv6");
BLOCKED.addSubnet("fe80::", 10, "ipv6");
BLOCKED.addSubnet("ff00::", 8, "ipv6");

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.goog",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

function isBlockedIp(ip: string): boolean {
  if (ip.startsWith("::ffff:")) {
    const v4 = ip.slice(7);
    if (isIP(v4) === 4) return BLOCKED.check(v4, "ipv4");
  }
  const kind = isIP(ip);
  if (kind === 4) return BLOCKED.check(ip, "ipv4");
  if (kind === 6) return BLOCKED.check(ip, "ipv6");
  return true;
}

function blockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host || BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  const kind = isIP(host);
  if (kind === 4 || kind === 6) return isBlockedIp(host);
  if (!host.includes(".")) return true;
  return false;
}

export function parseSafeRedirectTarget(raw: string): URL | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > 2048) return null;
  if (/[\u0000-\u001f\u007f\s\\]/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (blockedHostname(url.hostname)) return null;
  return url;
}

export function isSafeRedirectTarget(raw: string): boolean {
  return parseSafeRedirectTarget(raw) !== null;
}

const dnsCache = new Map<string, { expires: number; blocked: boolean }>();
const DNS_TTL_MS = 60_000;

async function hostnameResolvesBlocked(hostname: string, failClosed: boolean): Promise<boolean> {
  const key = hostname.toLowerCase();
  const now = Date.now();
  const hit = dnsCache.get(key);
  if (hit && hit.expires > now) return hit.blocked;
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) return failClosed;
    const blocked = records.some((record) => isBlockedIp(record.address));
    dnsCache.set(key, { expires: now + DNS_TTL_MS, blocked });
    return blocked;
  } catch {
    return failClosed;
  }
}

// Oeffentliche Weiterleitung: literale interne Ziele sperren.
// Loest der Name auf eine interne Adresse auf, ebenfalls sperren.
// Schlaegt DNS fehl, bleibt die Weiterleitung auf den geprueften Namen stehen.
export async function redirectTargetAllowed(raw: string): Promise<boolean> {
  const url = parseSafeRedirectTarget(raw);
  if (!url) return false;
  if (isIP(url.hostname)) return true;
  return !(await hostnameResolvesBlocked(url.hostname, false));
}

// Serverseitige Abrufe (Webhook, Chain-Check): DNS-Fehler ist ein Abbruch.
export async function assertOutboundUrl(raw: string): Promise<URL | null> {
  const url = parseSafeRedirectTarget(raw);
  if (!url) return null;
  if (isIP(url.hostname)) return url;
  if (await hostnameResolvesBlocked(url.hostname, true)) return null;
  return url;
}

export function isSafeRequestPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return false;
  if (path.length > 2048) return false;
  if (/[\u0000-\u001f\u007f\s\\]/.test(path)) return false;
  if (path.includes("://")) return false;
  return true;
}

export function safeContinuePath(reqPath: string): string {
  const path = reqPath || "/";
  if (!isSafeRequestPath(path)) return "/?nr_continue=1";
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}nr_continue=1`;
}

export function buildRedirectLocation(input: {
  targetUrl: string;
  catchallUrl: string | null;
  preservePath: boolean;
  pathname: string | null;
  path: string | null;
}): string | null {
  const pathname = input.pathname || "/";
  const useCatchall = !!input.catchallUrl && pathname.length > 1;
  const chosen = (useCatchall ? input.catchallUrl! : input.targetUrl).trim();
  const base = parseSafeRedirectTarget(chosen);
  if (!base) return null;
  if (useCatchall || !input.preservePath) return chosen;
  const extra = input.path || "";
  if (!extra || extra === "/") return chosen;
  if (!isSafeRequestPath(extra)) return chosen;
  const combined = chosen + extra;
  const parsed = parseSafeRedirectTarget(combined);
  if (!parsed) return chosen;
  if (parsed.protocol !== base.protocol || parsed.hostname !== base.hostname || parsed.port !== base.port) return chosen;
  if (parsed.username || parsed.password) return chosen;
  return combined;
}

export function caddySafeTarget(raw: string | null | undefined): string | null {
  if (!raw || !isSafeRedirectTarget(raw)) return null;
  if (/[\s"'{}\\]/.test(raw)) return null;
  return raw;
}
