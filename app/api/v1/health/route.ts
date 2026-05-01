import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDb } from "@/lib/db";
import pkg from "../../../../package.json";

export async function GET() {
  const db = getDb();
  const since24h = Date.now() - 24 * 60 * 60 * 1000;

  let dbSize = 0;
  try {
    const dbPath = path.join(process.env.NEXREDIRECT_DATA_DIR || path.join(process.cwd(), "data"), "nexredirect.db");
    dbSize = fs.statSync(dbPath).size;
  } catch {}

  const totals = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM domains) AS total,
      (SELECT COUNT(*) FROM domains WHERE status='active') AS active,
      (SELECT COUNT(*) FROM domains WHERE status='pending') AS pending,
      (SELECT COUNT(*) FROM domains WHERE status='error') AS errored
  `).get() as { total: number; active: number; pending: number; errored: number };

  const hits24h = (db.prepare("SELECT COUNT(*) AS n FROM hits WHERE ts > ?").get(since24h) as { n: number }).n;
  let blocklist = 0;
  try {
    blocklist = (db.prepare("SELECT COUNT(*) AS n FROM ip_blocklist WHERE expires_at > ?").get(Date.now()) as { n: number }).n;
  } catch {}

  return NextResponse.json({
    ok: true,
    ts: Date.now(),
    version: pkg.version,
    domains: totals,
    hits_24h: hits24h,
    blocked_ips: blocklist,
    db_bytes: dbSize,
  });
}
