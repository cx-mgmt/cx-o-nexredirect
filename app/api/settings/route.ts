import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/db";
import { isValidDomain } from "@/lib/dns";
import { assertOutboundUrl } from "@/lib/safe-url";

const PUBLIC_KEYS = ["base_domain", "admin_email", "update_auto", "update_include_prereleases", "hits_retention_days", "webhook_url"];

async function settingError(key: string, value: string): Promise<string | null> {
  if (key === "base_domain" && value && !isValidDomain(value)) return "invalid_base_domain";
  if (key === "admin_email" && value && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value)) return "invalid_admin_email";
  if ((key === "update_auto" || key === "update_include_prereleases") && value !== "true" && value !== "false") return "invalid_flag";
  if (key === "hits_retention_days" && !/^\d+$/.test(value)) return "invalid_retention";
  if (key === "hits_retention_days") {
    const days = Number(value);
    if (days < 1 || days > 3650) return "invalid_retention";
  }
  if (key === "webhook_url" && value && !(await assertOutboundUrl(value))) return "webhook_url_rejected";
  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "forbidden", code: "admin_required" }, { status: 403 });
  const out: Record<string, string | null> = {};
  for (const k of PUBLIC_KEYS) out[k] = getSetting(k);
  return NextResponse.json(out);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "forbidden", code: "admin_required" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const updates: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!PUBLIC_KEYS.includes(k)) continue;
    const value = String(v ?? "");
    const problem = await settingError(k, value);
    if (problem) return NextResponse.json({ error: problem }, { status: 422 });
    updates[k] = value;
  }
  for (const [k, v] of Object.entries(updates)) setSetting(k, v);
  return NextResponse.json({ ok: true });
}
