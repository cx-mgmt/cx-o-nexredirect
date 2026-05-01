import { NextResponse } from "next/server";
import { requireScope } from "@/lib/api-auth";
import { getDb, type DomainRow } from "@/lib/db";
import { reloadCaddy } from "@/lib/caddy";
import { invalidateRedirectCache } from "@/lib/redirect-resolver";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireScope(req, "read:domains");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const row = getDb().prepare("SELECT * FROM domains WHERE id = ?").get(Number(id)) as DomainRow | undefined;
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ domain: row });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireScope(req, "write:domains");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const db = getDb();
  const row = db.prepare("SELECT * FROM domains WHERE id = ?").get(Number(id)) as DomainRow | undefined;
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  db.prepare("DELETE FROM domains WHERE id = ?").run(Number(id));
  invalidateRedirectCache();
  if (row.status === "active") reloadCaddy().catch(() => {});
  return NextResponse.json({ ok: true });
}
