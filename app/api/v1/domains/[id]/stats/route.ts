import { NextResponse } from "next/server";
import { requireScope } from "@/lib/api-auth";
import { getDb } from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireScope(req, "read:analytics");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const url = new URL(req.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") || 30)));
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const db = getDb();

  const total = (db.prepare("SELECT COUNT(*) AS n FROM hits WHERE domain_id = ? AND ts > ?").get(Number(id), since) as { n: number }).n;
  const daily = db.prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS day, COUNT(*) AS hits
    FROM hits WHERE domain_id = ? AND ts > ?
    GROUP BY day ORDER BY day
  `).all(Number(id), since);
  const byCountry = db.prepare(`
    SELECT COALESCE(country,'??') AS country, COUNT(*) AS hits
    FROM hits WHERE domain_id = ? AND ts > ?
    GROUP BY country ORDER BY hits DESC
  `).all(Number(id), since);

  return NextResponse.json({ domain_id: Number(id), days, total, daily, by_country: byCountry });
}
