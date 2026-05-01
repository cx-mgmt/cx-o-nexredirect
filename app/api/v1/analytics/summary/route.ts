import { NextResponse } from "next/server";
import { requireScope } from "@/lib/api-auth";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  const auth = requireScope(req, "read:analytics");
  if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") || 30)));
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const db = getDb();

  const total = (db.prepare("SELECT COUNT(*) AS n FROM hits WHERE ts > ?").get(since) as { n: number }).n;
  const top = db.prepare(`
    SELECT d.id, d.domain, COUNT(h.id) AS hits
    FROM hits h JOIN domains d ON d.id = h.domain_id
    WHERE h.ts > ? GROUP BY d.id, d.domain ORDER BY hits DESC LIMIT 50
  `).all(since);
  const byCountry = db.prepare(`
    SELECT COALESCE(country,'??') AS country, COUNT(*) AS hits
    FROM hits WHERE ts > ? GROUP BY country ORDER BY hits DESC
  `).all(since);
  const daily = db.prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS day, COUNT(*) AS hits
    FROM hits WHERE ts > ? GROUP BY day ORDER BY day
  `).all(since);

  return NextResponse.json({ days, total, daily, top, by_country: byCountry });
}
