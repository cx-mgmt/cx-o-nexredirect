import { NextResponse } from "next/server";
import { requireScope } from "@/lib/api-auth";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  const auth = requireScope(req, "read:hits");
  if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") || 100)));
  const domainId = url.searchParams.get("domain_id");

  const db = getDb();
  const rows = domainId
    ? db.prepare("SELECT id, domain_id, ts, ip_hash, country, user_agent, referer, path FROM hits WHERE domain_id = ? ORDER BY ts DESC LIMIT ?").all(Number(domainId), limit)
    : db.prepare("SELECT id, domain_id, ts, ip_hash, country, user_agent, referer, path FROM hits ORDER BY ts DESC LIMIT ?").all(limit);

  return NextResponse.json({ hits: rows });
}
