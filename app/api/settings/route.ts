import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/db";

const PUBLIC_KEYS = ["base_domain", "admin_email", "update_auto", "update_include_prereleases", "hits_retention_days", "webhook_url"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const out: Record<string, string | null> = {};
  for (const k of PUBLIC_KEYS) out[k] = getSetting(k);
  return NextResponse.json(out);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  for (const [k, v] of Object.entries(body)) {
    if (!PUBLIC_KEYS.includes(k)) continue;
    setSetting(k, String(v));
  }
  return NextResponse.json({ ok: true });
}
