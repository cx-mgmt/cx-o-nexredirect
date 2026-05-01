import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") || 30)));
  const domainId = url.searchParams.get("domain_id");
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const db = getDb();

  const where = domainId ? "ts > ? AND domain_id = ?" : "ts > ?";
  const args: unknown[] = domainId ? [since, Number(domainId)] : [since];

  const daily = db.prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS day, COUNT(*) AS hits
    FROM hits WHERE ${where}
    GROUP BY day ORDER BY day
  `).all(...args);

  const top = db.prepare(`
    SELECT d.id, d.domain, COUNT(h.id) AS hits
    FROM hits h JOIN domains d ON d.id = h.domain_id
    WHERE h.ts > ?
    GROUP BY d.id, d.domain
    ORDER BY hits DESC LIMIT 20
  `).all(since);

  const byCountry = db.prepare(`
    SELECT COALESCE(country,'??') AS country, COUNT(*) AS hits
    FROM hits WHERE ${where}
    GROUP BY country ORDER BY hits DESC LIMIT 20
  `).all(...args);

  const dead = db.prepare(`
    SELECT d.id, d.domain, d.status, d.target_url, d.created_at,
      (SELECT MAX(ts) FROM hits h WHERE h.domain_id = d.id) AS last_hit
    FROM domains d
    WHERE d.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM hits h WHERE h.domain_id = d.id AND h.ts > ?)
    ORDER BY d.created_at
  `).all(Date.now() - 90 * 24 * 60 * 60 * 1000);

  return NextResponse.json({ daily, top, byCountry, dead });
}
