import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, type DomainRow } from "@/lib/db";
import { isValidDomain } from "@/lib/dns";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = getDb()
    .prepare(`
      SELECT d.*, g.name AS group_name, g.target_url AS group_target,
        (SELECT COUNT(*) FROM hits h WHERE h.domain_id = d.id) AS total_hits,
        (SELECT MAX(ts) FROM hits h WHERE h.domain_id = d.id) AS last_hit
      FROM domains d
      LEFT JOIN domain_groups g ON g.id = d.group_id
      ORDER BY d.created_at DESC
    `)
    .all();
  return NextResponse.json({ domains: rows });
}

const createSchema = z.object({
  domain: z.string().min(3).transform((s) => s.toLowerCase().trim()),
  target_url: z.string().url().optional(),
  group_id: z.number().int().optional(),
  redirect_code: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]).default(301),
  preserve_path: z.boolean().default(true),
  include_www: z.boolean().default(true),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });
  }
  const { domain, target_url, group_id, redirect_code, preserve_path, include_www } = parsed.data;

  if (!isValidDomain(domain)) return NextResponse.json({ error: "invalid_domain" }, { status: 400 });
  if (!target_url && !group_id) return NextResponse.json({ error: "target_required" }, { status: 400 });

  const db = getDb();
  const existing = db.prepare("SELECT id FROM domains WHERE domain = ?").get(domain) as { id: number } | undefined;
  if (existing) return NextResponse.json({ error: "domain_exists" }, { status: 409 });

  const result = db
    .prepare(`INSERT INTO domains (domain, status, target_url, group_id, redirect_code, preserve_path, include_www, created_by, created_at)
              VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      domain,
      target_url ?? null,
      group_id ?? null,
      redirect_code,
      preserve_path ? 1 : 0,
      include_www ? 1 : 0,
      Number(session.user.id),
      Date.now()
    );

  const row = db.prepare("SELECT * FROM domains WHERE id = ?").get(result.lastInsertRowid) as DomainRow;
  return NextResponse.json({ domain: row }, { status: 201 });
}
