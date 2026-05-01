import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, type DomainGroupRow } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const groups = getDb().prepare(`
    SELECT g.*, (SELECT COUNT(*) FROM domains d WHERE d.group_id = g.id) AS domain_count
    FROM domain_groups g ORDER BY g.created_at DESC
  `).all();
  return NextResponse.json({ groups });
}

const schema = z.object({
  name: z.string().min(1).max(100),
  target_url: z.string().url(),
  redirect_code: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]).default(301),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });

  const { name, target_url, redirect_code } = parsed.data;
  const result = getDb().prepare(
    "INSERT INTO domain_groups (name, target_url, redirect_code, created_by, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(name, target_url, redirect_code, Number(session.user.id), Date.now());

  const group = getDb().prepare("SELECT * FROM domain_groups WHERE id = ?").get(result.lastInsertRowid) as DomainGroupRow;
  return NextResponse.json({ group }, { status: 201 });
}
