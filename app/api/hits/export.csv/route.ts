import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") || 30)));
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const domainId = url.searchParams.get("domain_id");

  const rows = domainId
    ? getDb().prepare(`SELECT datetime(h.ts/1000,'unixepoch') AS ts, d.domain, h.country, h.path, h.user_agent, h.referer
        FROM hits h JOIN domains d ON d.id = h.domain_id WHERE h.domain_id = ? AND h.ts > ? ORDER BY h.ts DESC LIMIT 100000`).all(Number(domainId), since)
    : getDb().prepare(`SELECT datetime(h.ts/1000,'unixepoch') AS ts, d.domain, h.country, h.path, h.user_agent, h.referer
        FROM hits h JOIN domains d ON d.id = h.domain_id WHERE h.ts > ? ORDER BY h.ts DESC LIMIT 100000`).all(since);

  const csv = toCsv(rows as Record<string, unknown>[]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hits-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
