import { isIPv4 } from "net";

function normalizeIp(ip: string): string {
  if (ip === "::1") return "127.0.0.1";
  if (ip.startsWith("::ffff:")) {
    const v4 = ip.slice(7);
    if (isIPv4(v4)) return v4;
  }
  return ip;
}

function ipv4ToNum(ip: string): number {
  return ip.split(".").reduce((acc, p) => acc * 256 + parseInt(p, 10), 0);
}

function isInCidr4(ip: string, cidr: string): boolean {
  const slash = cidr.indexOf("/");
  if (slash === -1) return ip === cidr;
  const base = cidr.slice(0, slash);
  const prefix = parseInt(cidr.slice(slash + 1), 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;
  if (!isIPv4(base) || !isIPv4(ip)) return false;
  const shift = 32 - prefix;
  return (ipv4ToNum(ip) >>> shift) === (ipv4ToNum(base) >>> shift);
}

export function parseAllowlist(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return (parsed as unknown[])
        .filter((s): s is string => typeof s === "string" && s.trim() !== "")
        .map((s) => s.trim());
    }
  } catch {}
  return [];
}

export function isIpAllowed(rawIp: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  const ip = normalizeIp(rawIp);
  for (const entry of allowlist) {
    if (entry === ip || entry === rawIp) return true;
    if (entry.includes("/") && isIPv4(ip) && isIPv4(entry.split("/")[0])) {
      if (isInCidr4(ip, entry)) return true;
    }
  }
  return false;
}
