import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, type DomainRow } from "@/lib/db";
import { checkDomainDns } from "@/lib/dns";
import { reloadCaddy } from "@/lib/caddy";
import { invalidateRedirectCache } from "@/lib/redirect-resolver";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const db = getDb();
  const row = db.prepare("SELECT * FROM domains WHERE id = ?").get(Number(id)) as DomainRow | undefined;
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const result = await checkDomainDns(row.domain, !!row.include_www);

  if (result.ok) {
    db.prepare("UPDATE domains SET status = 'active', verified_at = ? WHERE id = ?").run(Date.now(), row.id);
    invalidateRedirectCache();
    const reload = await reloadCaddy();
    return NextResponse.json({ ok: true, result, caddy_reloaded: reload.ok, caddy_error: reload.error });
  }

  db.prepare("UPDATE domains SET status = 'pending' WHERE id = ?").run(row.id);
  return NextResponse.json({ ok: false, result });
}
