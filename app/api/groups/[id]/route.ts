import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, type DomainGroupRow } from "@/lib/db";
import { reloadCaddy } from "@/lib/caddy";
import { invalidateRedirectCache } from "@/lib/redirect-resolver";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  target_url: z.string().url().optional(),
  redirect_code: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "forbidden", code: "admin_required" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === undefined) continue;
    fields.push(`${k} = ?`);
    values.push(v);
  }
  if (fields.length > 0) {
    values.push(Number(id));
    getDb().prepare(`UPDATE domain_groups SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }
  invalidateRedirectCache();
  reloadCaddy().catch(() => {});

  const group = getDb().prepare("SELECT * FROM domain_groups WHERE id = ?").get(Number(id)) as DomainGroupRow | undefined;
  if (!group) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ group });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "forbidden", code: "admin_required" }, { status: 403 });
  const { id } = await params;

  const db = getDb();
  const used = (db.prepare("SELECT COUNT(*) AS n FROM domains WHERE group_id = ?").get(Number(id)) as { n: number }).n;
  if (used > 0) return NextResponse.json({ error: "group_in_use", domains: used }, { status: 409 });

  db.prepare("DELETE FROM domain_groups WHERE id = ?").run(Number(id));
  return NextResponse.json({ ok: true });
}
