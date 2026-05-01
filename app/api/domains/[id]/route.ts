import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, logAudit, type DomainRow } from "@/lib/db";
import { reloadCaddy } from "@/lib/caddy";
import { invalidateRedirectCache } from "@/lib/redirect-resolver";

const sunsetSchema = z.object({
  enabled: z.boolean(),
  title: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
  button_label: z.string().max(50).optional(),
  sunset_date: z.string().max(50).optional(),
});

const updateSchema = z.object({
  target_url: z.string().url().nullable().optional(),
  group_id: z.number().int().nullable().optional(),
  redirect_code: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]).optional(),
  preserve_path: z.boolean().optional(),
  include_www: z.boolean().optional(),
  sunset_config: sunsetSchema.nullable().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const row = getDb().prepare("SELECT * FROM domains WHERE id = ?").get(Number(id)) as DomainRow | undefined;
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ domain: row });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });

  const db = getDb();
  const existing = db.prepare("SELECT * FROM domains WHERE id = ?").get(Number(id)) as DomainRow | undefined;
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(parsed.data)) {
    if (val === undefined) continue;
    if (key === "preserve_path" || key === "include_www") {
      fields.push(`${key} = ?`);
      values.push(val ? 1 : 0);
    } else if (key === "sunset_config") {
      fields.push(`sunset_config = ?`);
      values.push(val === null ? null : JSON.stringify(val));
    } else {
      fields.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (fields.length > 0) {
    values.push(Number(id));
    db.prepare(`UPDATE domains SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }

  if (existing.status === "active") {
    invalidateRedirectCache();
    reloadCaddy().catch(() => {});
  }

  const row = db.prepare("SELECT * FROM domains WHERE id = ?").get(Number(id)) as DomainRow;
  logAudit({ user_id: Number(session.user.id), user_email: session.user.email, action: "domain.update", target_type: "domain", target_id: row.id, details: parsed.data });
  return NextResponse.json({ domain: row });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const db = getDb();
  const row = db.prepare("SELECT * FROM domains WHERE id = ?").get(Number(id)) as DomainRow | undefined;
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  db.prepare("DELETE FROM domains WHERE id = ?").run(Number(id));
  invalidateRedirectCache();
  if (row.status === "active") reloadCaddy().catch(() => {});
  logAudit({ user_id: Number(session.user.id), user_email: session.user.email, action: "domain.delete", target_type: "domain", target_id: row.id, details: { domain: row.domain } });

  return NextResponse.json({ ok: true });
}
