import { NextResponse } from "next/server";
import { z } from "zod";
import { requireScope } from "@/lib/api-auth";
import { getDb, type DomainRow } from "@/lib/db";
import { isValidDomain, getServerIps } from "@/lib/dns";

export async function GET(req: Request) {
  const auth = requireScope(req, "read:domains");
  if (auth instanceof NextResponse) return auth;
  const rows = getDb().prepare(`
    SELECT d.*, g.name AS group_name, g.target_url AS group_target,
      (SELECT COUNT(*) FROM hits h WHERE h.domain_id = d.id) AS total_hits,
      (SELECT MAX(ts) FROM hits h WHERE h.domain_id = d.id) AS last_hit
    FROM domains d LEFT JOIN domain_groups g ON g.id = d.group_id
    ORDER BY d.created_at DESC
  `).all();
  return NextResponse.json({ domains: rows });
}

const schema = z.object({
  domain: z.string().min(3).transform((s) => s.toLowerCase().trim()),
  target_url: z.string().url().optional(),
  group_id: z.number().int().optional(),
  redirect_code: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]).default(301),
  preserve_path: z.boolean().default(true),
  include_www: z.boolean().default(true),
});

export async function POST(req: Request) {
  const auth = requireScope(req, "write:domains");
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });
  const { domain, target_url, group_id, redirect_code, preserve_path, include_www } = parsed.data;
  if (!isValidDomain(domain)) return NextResponse.json({ error: "invalid_domain" }, { status: 400 });
  if (!target_url && !group_id) return NextResponse.json({ error: "target_required" }, { status: 400 });

  const db = getDb();
  const exists = db.prepare("SELECT id FROM domains WHERE domain = ?").get(domain);
  if (exists) return NextResponse.json({ error: "domain_exists" }, { status: 409 });

  const result = db.prepare(`INSERT INTO domains (domain, status, target_url, group_id, redirect_code, preserve_path, include_www, created_at)
    VALUES (?, 'pending', ?, ?, ?, ?, ?, ?)`).run(
    domain, target_url ?? null, group_id ?? null, redirect_code, preserve_path ? 1 : 0, include_www ? 1 : 0, Date.now()
  );

  const row = db.prepare("SELECT * FROM domains WHERE id = ?").get(result.lastInsertRowid) as DomainRow;
  const ips = await getServerIps();
  return NextResponse.json({
    domain: row,
    dns_records: [
      { type: "A", name: domain, value: ips.ipv4 ?? null },
      ...(ips.ipv6 ? [{ type: "AAAA", name: domain, value: ips.ipv6 }] : []),
      ...(include_www ? [{ type: "A", name: `www.${domain}`, value: ips.ipv4 ?? null }] : []),
    ],
  }, { status: 201 });
}
