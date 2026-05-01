import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = getDb().prepare(`
    SELECT d.id, d.domain, d.status, d.target_url,
      (SELECT name FROM domain_groups g WHERE g.id = d.group_id) AS group_name,
      d.redirect_code, d.preserve_path, d.include_www,
      datetime(d.created_at/1000,'unixepoch') AS created_at,
      datetime(d.verified_at/1000,'unixepoch') AS verified_at,
      (SELECT COUNT(*) FROM hits h WHERE h.domain_id = d.id) AS total_hits,
      (SELECT datetime(MAX(ts)/1000,'unixepoch') FROM hits h WHERE h.domain_id = d.id) AS last_hit
    FROM domains d ORDER BY d.created_at DESC
  `).all() as Record<string, unknown>[];

  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="domains-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
