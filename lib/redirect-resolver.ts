import { getDb, getSetting, parseSunset, type DomainRow, type DomainGroupRow, type SunsetConfig } from "./db";

export type ResolvedRedirect = {
  domain_id: number;
  domain: string;
  target_url: string;
  redirect_code: number;
  preserve_path: boolean;
  sunset: SunsetConfig | null;
};

let cache: Map<string, ResolvedRedirect> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5_000;

function loadCache(): Map<string, ResolvedRedirect> {
  const db = getDb();
  const domains = db.prepare("SELECT * FROM domains WHERE status = 'active'").all() as DomainRow[];
  const groups = db.prepare("SELECT * FROM domain_groups").all() as DomainGroupRow[];
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  const m = new Map<string, ResolvedRedirect>();
  for (const d of domains) {
    const target = d.target_url ?? (d.group_id ? groupMap.get(d.group_id)?.target_url : null);
    if (!target) continue;
    const r: ResolvedRedirect = {
      domain_id: d.id,
      domain: d.domain,
      target_url: target,
      redirect_code: d.redirect_code,
      preserve_path: !!d.preserve_path,
      sunset: parseSunset(d),
    };
    m.set(d.domain.toLowerCase(), r);
    if (d.include_www) m.set(`www.${d.domain.toLowerCase()}`, r);
  }
  return m;
}

export function invalidateRedirectCache() {
  cache = null;
}

export function resolveHost(host: string): ResolvedRedirect | null {
  const now = Date.now();
  if (!cache || now - cacheLoadedAt > CACHE_TTL_MS) {
    cache = loadCache();
    cacheLoadedAt = now;
  }
  return cache.get(host.toLowerCase()) ?? null;
}

export function isAdminHost(host: string): boolean {
  const baseDomain = getSetting("base_domain");
  const serverIp = getSetting("server_ip");
  const h = host.toLowerCase().split(":")[0];
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  if (baseDomain && h === baseDomain.toLowerCase()) return true;
  if (serverIp && h === serverIp) return true;
  return false;
}
