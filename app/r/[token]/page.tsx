import { notFound } from "next/navigation";
import { getDb, type DomainRow } from "@/lib/db";
import { verifyPdfToken } from "@/lib/pdf-token";
import { ReportClient } from "./ReportClient";

export const dynamic = "force-dynamic";

export default async function PublicReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = verifyPdfToken(token);
  if (!p) notFound();

  const days = Math.min(365, Math.max(1, Number(p.days || 30)));
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const db = getDb();
  const isDomainReport = p.kind === "domain" && p.domain_id;

  if (isDomainReport) {
    const did = Number(p.domain_id);
    const domain = db.prepare("SELECT * FROM domains WHERE id = ?").get(did) as DomainRow | undefined;
    if (!domain) notFound();

    const totalHits = (db.prepare("SELECT COUNT(*) AS n FROM hits WHERE domain_id = ? AND ts > ?").get(did, since) as { n: number }).n;
    const uniqueIps = (db.prepare("SELECT COUNT(DISTINCT ip_hash) AS n FROM hits WHERE domain_id = ? AND ts > ?").get(did, since) as { n: number }).n;
    const daily = db.prepare(`SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS day, COUNT(*) AS hits FROM hits WHERE domain_id = ? AND ts > ? GROUP BY day ORDER BY day`).all(did, since) as { day: string; hits: number }[];
    const country = db.prepare(`SELECT COALESCE(country,'??') AS country, COUNT(*) AS hits FROM hits WHERE domain_id = ? AND ts > ? GROUP BY country ORDER BY hits DESC`).all(did, since) as { country: string; hits: number }[];
    const recentHits = db.prepare(`SELECT h.ts, d.domain, h.country, h.path FROM hits h JOIN domains d ON d.id = h.domain_id WHERE h.domain_id = ? AND h.ts > ? ORDER BY h.ts DESC LIMIT 200`).all(did, since) as { ts: number; domain: string; country: string | null; path: string | null }[];

    return (
      <ReportClient
        data={{
          days,
          sections: {
            summary: true,
            daily: true,
            top: false,
            country: country.length > 0,
            perDomain: false,
            dead: false,
            hits: true,
            title: typeof p.title === "string" ? p.title : `Report: ${domain.domain}`,
          },
          totalDomains: 1,
          activeDomains: domain.status === "active" ? 1 : 0,
          totalHits,
          uniqueIps,
          daily,
          top: [{ domain: domain.domain, hits: totalHits }],
          country,
          dead: [],
          perDomain: [],
          recentHits,
          generatedAt: Date.now(),
        }}
      />
    );
  }

  const sections = {
    summary: p.summary === "1",
    daily: p.daily === "1",
    top: p.top === "1",
    country: p.country === "1",
    perDomain: p.perDomain === "1",
    dead: p.dead === "1",
    hits: p.hits === "1",
    title: typeof p.title === "string" ? p.title : "Domain-Redirect-Report",
  };

  const totalDomains = (db.prepare("SELECT COUNT(*) AS n FROM domains").get() as { n: number }).n;
  const activeDomains = (db.prepare("SELECT COUNT(*) AS n FROM domains WHERE status='active'").get() as { n: number }).n;
  const totalHits = (db.prepare("SELECT COUNT(*) AS n FROM hits WHERE ts > ?").get(since) as { n: number }).n;
  const uniqueIps = (db.prepare("SELECT COUNT(DISTINCT ip_hash) AS n FROM hits WHERE ts > ?").get(since) as { n: number }).n;

  const daily = db.prepare(`SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS day, COUNT(*) AS hits FROM hits WHERE ts > ? GROUP BY day ORDER BY day`).all(since) as { day: string; hits: number }[];
  const top = db.prepare(`SELECT d.domain, COUNT(h.id) AS hits FROM hits h JOIN domains d ON d.id = h.domain_id WHERE h.ts > ? GROUP BY d.domain ORDER BY hits DESC`).all(since) as { domain: string; hits: number }[];
  const country = db.prepare(`SELECT COALESCE(country,'??') AS country, COUNT(*) AS hits FROM hits WHERE ts > ? GROUP BY country ORDER BY hits DESC`).all(since) as { country: string; hits: number }[];
  const dead = db.prepare(`SELECT d.id, d.domain, d.target_url, d.created_at FROM domains d WHERE d.status='active' AND NOT EXISTS (SELECT 1 FROM hits h WHERE h.domain_id = d.id AND h.ts > ?) ORDER BY d.created_at`).all(Date.now() - 90 * 24 * 60 * 60 * 1000) as { id: number; domain: string; target_url: string | null; created_at: number }[];

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

  return (
    <ReportClient
      data={{
        days, sections,
        totalDomains, activeDomains, totalHits, uniqueIps,
        daily, top, country, dead, perDomain, recentHits,
        generatedAt: Date.now(),
      }}
    />
  );
}
