import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, logAudit } from "@/lib/db";
import { invalidateRedirectCache } from "@/lib/redirect-resolver";

const sunsetSchema = z.object({
  enabled: z.boolean(),
  title: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
  button_label: z.string().max(50).optional(),
  sunset_date: z.string().max(50).optional(),
});

const bodySchema = z.object({
  domain_ids: z.array(z.number().int()).min(1).max(500),
  config: sunsetSchema.nullable(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "forbidden", code: "admin_required" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });

  const { domain_ids, config } = parsed.data;
  const value = config === null ? null : JSON.stringify(config);

  const db = getDb();
  const placeholders = domain_ids.map(() => "?").join(",");
  db.prepare(`UPDATE domains SET sunset_config = ? WHERE id IN (${placeholders})`).run(value, ...domain_ids);

  invalidateRedirectCache();
  logAudit({ user_id: Number(session.user.id), user_email: session.user.email, action: "sunset.bulk", target_type: "domain", target_id: domain_ids.join(","), details: { enabled: !!config?.enabled, count: domain_ids.length } });
  return NextResponse.json({ ok: true, updated: domain_ids.length });
}
