import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { ReportClient } from "./ReportClient";

export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };

function parseDays(sp: SP): number {
  const v = sp.days;
  const s = Array.isArray(v) ? v[0] : v;
  const n = Number(s || 30);
  return Number.isFinite(n) && n > 0 ? Math.min(365, n) : 30;
}

function flag(sp: SP, key: string, def = true): boolean {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  if (s === undefined) return def;
  return s === "1" || s === "true";
}

export default async function ReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const days = parseDays(sp);
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const db = getDb();

  const sections = {
    summary: flag(sp, "summary"),
    daily: flag(sp, "daily"),
    top: flag(sp, "top"),
    country: flag(sp, "country"),
    perDomain: flag(sp, "perDomain", false),
    dead: flag(sp, "dead"),
    hits: flag(sp, "hits", false),
    title: typeof sp.title === "string" ? sp.title : "Domain-Redirect-Report",
  };

  const totalDomains = (db.prepare("SELECT COUNT(*) AS n FROM domains").get() as { n: number }).n;
  const activeDomains = (db.prepare("SELECT COUNT(*) AS n FROM domains WHERE status='active'").get() as { n: number }).n;
  const totalHits = (db.prepare("SELECT COUNT(*) AS n FROM hits WHERE ts > ?").get(since) as { n: number }).n;
  const uniqueIps = (db.prepare("SELECT COUNT(DISTINCT ip_hash) AS n FROM hits WHERE ts > ?").get(since) as { n: number }).n;

  const daily = db.prepare(`SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS day, COUNT(*) AS hits FROM hits WHERE ts > ? GROUP BY day ORDER BY day`).all(since) as { day: string; hits: number }[];
  const top = db.prepare(`SELECT d.domain, COUNT(h.id) AS hits FROM hits h JOIN domains d ON d.id = h.domain_id WHERE h.ts > ? GROUP BY d.domain ORDER BY hits DESC`).all(since) as { domain: string; hits: number }[];
  const country = db.prepare(`SELECT COALESCE(country,'??') AS country, COUNT(*) AS hits FROM hits WHERE ts > ? GROUP BY country ORDER BY hits DESC`).all(since) as { country: string; hits: number }[];
  const dead = db.prepare(`SELECT d.id, d.domain, d.target_url, d.created_at FROM domains d WHERE d.status='active' AND NOT EXISTS (SELECT 1 FROM hits h WHERE h.domain_id = d.id AND h.ts > ?) ORDER BY d.created_at`).all(Date.now() - 90*24*60*60*1000) as { id: number; domain: string; target_url: string | null; created_at: number }[];

  const perDomain = sections.perDomain
    ? (db.prepare(`SELECT d.id, d.domain, d.target_url, d.redirect_code, d.status,
        (SELECT COUNT(*) FROM hits h WHERE h.domain_id = d.id AND h.ts > ?) AS hits_period,
        (SELECT COUNT(*) FROM hits h WHERE h.domain_id = d.id) AS hits_total,
        (SELECT MAX(ts) FROM hits h WHERE h.domain_id = d.id) AS last_hit
        FROM domains d ORDER BY hits_period DESC, d.domain`).all(since) as { id: number; domain: string; target_url: string | null; redirect_code: number; status: string; hits_period: number; hits_total: number; last_hit: number | null }[])
    : [];

  const recentHits = sections.hits
    ? (db.prepare(`SELECT h.ts, d.domain, h.country, h.path FROM hits h JOIN domains d ON d.id = h.domain_id WHERE h.ts > ? ORDER BY h.ts DESC LIMIT 200`).all(since) as { ts: number; domain: string; country: string | null; path: string | null }[])
    : [];

  if (!totalDomains) notFound();

  return (
    <ReportClient
      data={{
        days,
        sections,
        totalDomains,
        activeDomains,
        totalHits,
        uniqueIps,
        daily,
        top,
        country,
        dead,
        perDomain,
        recentHits,
        generatedAt: Date.now(),
      }}
    />
  );
}
