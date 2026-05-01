import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, logAudit } from "@/lib/db";
import { reloadCaddy } from "@/lib/caddy";
import { invalidateRedirectCache } from "@/lib/redirect-resolver";

const schema = z.object({
  domain_ids: z.array(z.number().int()).min(1).max(500),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { domain_ids } = parsed.data;
  const db = getDb();
  const placeholders = domain_ids.map(() => "?").join(",");
  const hadActive = (db.prepare(`SELECT COUNT(*) AS n FROM domains WHERE status='active' AND id IN (${placeholders})`).get(...domain_ids) as { n: number }).n;
  const result = db.prepare(`DELETE FROM domains WHERE id IN (${placeholders})`).run(...domain_ids);

  invalidateRedirectCache();
  if (hadActive > 0) reloadCaddy().catch(() => {});
  logAudit({ user_id: Number(session.user.id), user_email: session.user.email, action: "domain.bulk_delete", target_type: "domain", target_id: domain_ids.join(","), details: { count: Number(result.changes) } });

  return NextResponse.json({ ok: true, deleted: Number(result.changes) });
}
