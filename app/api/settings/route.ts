import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/db";

const PUBLIC_KEYS = ["base_domain", "admin_email", "update_auto", "update_include_prereleases", "hits_retention_days", "webhook_url"];

function isPrivateUrl(raw: string): boolean {
  try {
    const { hostname } = new URL(raw);
    const h = hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets
    if (/^localhost$/i.test(h)) return true;
    if (/^127\./.test(h)) return true;
    if (/^10\./.test(h)) return true;
    if (/^192\.168\./.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
    if (/^169\.254\./.test(h)) return true;
    if (/^::1$/.test(h)) return true;
    if (/^fc[0-9a-f]{2}/i.test(h)) return true;
    return false;
  } catch {
    return true;
  }
}

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
  if (session.user.role !== "admin") return NextResponse.json({ error: "forbidden", code: "admin_required" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  for (const [k, v] of Object.entries(body)) {
    if (!PUBLIC_KEYS.includes(k)) continue;
    if (k === "webhook_url" && v && isPrivateUrl(String(v))) {
      return NextResponse.json({ error: "webhook_url must not point to a private or loopback address" }, { status: 422 });
    }
    setSetting(k, String(v));
  }
  return NextResponse.json({ ok: true });
}
