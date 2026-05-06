import { NextResponse } from "next/server";
import { z } from "zod";
import { getSetting, setSetting, logAudit } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET(req: Request) {
  const u = await requireAdmin();
  if (u instanceof NextResponse) return u;
  const raw = getSetting("admin_ip_allowlist");
  const allowlist: string[] = raw ? (JSON.parse(raw) as string[]) : [];
  const xff = req.headers.get("x-forwarded-for");
  const myIp = xff ? xff.split(",")[0].trim() : "unknown";
  return NextResponse.json({ allowlist, my_ip: myIp });
}

const schema = z.object({
  allowlist: z.array(z.string().min(1)).max(200),
});

export async function PUT(req: Request) {
  const u = await requireAdmin();
  if (u instanceof NextResponse) return u;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });
  const cleaned = parsed.data.allowlist.map((s) => s.trim()).filter(Boolean);
  setSetting("admin_ip_allowlist", JSON.stringify(cleaned));
  logAudit({ user_id: Number(u.id), user_email: u.email, action: "settings.ip_allowlist.update", details: { count: cleaned.length } });
  return NextResponse.json({ ok: true });
}
