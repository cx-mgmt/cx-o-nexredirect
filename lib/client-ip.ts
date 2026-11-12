import type { IncomingHttpHeaders } from "node:http";
import { isIP } from "node:net";

function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed === "::1") return "127.0.0.1";
  if (trimmed.startsWith("::ffff:")) {
    const v4 = trimmed.slice(7);
    if (isIP(v4) === 4) return v4;
  }
  return trimmed;
}

export function isTrustedProxyAddress(ip: string): boolean {
  const n = normalizeIp(ip);
  return n === "127.0.0.1";
}

// Hinter Caddy (Verbindung von localhost) zaehlt der letzte X-Forwarded-For-Eintrag,
// den der Proxy angehaengt hat. Eine direkte Verbindung ignoriert den Header,
// sonst laesst sich die Allowlist mit einem gefaelschten ersten Hop umgehen.
export function clientIpFromPeer(remoteAddress: string | undefined, forwardedFor: string | undefined): string {
  const remote = normalizeIp(remoteAddress || "");
  if (!remote || !isTrustedProxyAddress(remote)) return remote || "unknown";
  const parts = (forwardedFor || "")
    .split(",")
    .map((part) => normalizeIp(part))
    .filter(Boolean);
  return parts[parts.length - 1] || remote;
}

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.join(",");
  return value || "";
}

export function sanitizeInboundHeaders(headers: IncomingHttpHeaders, remoteAddress: string | undefined): string {
  const clientIp = clientIpFromPeer(remoteAddress, headerValue(headers["x-forwarded-for"]));
  headers["x-forwarded-for"] = clientIp;
  for (const key of Object.keys(headers)) {
    const lower = key.toLowerCase();
    if (
      lower === "x-middleware-subrequest" ||
      lower === "x-middleware-override-headers" ||
      lower.startsWith("x-middleware-request-")
    ) {
      delete headers[key];
    }
  }
  return clientIp;
}
