import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, getSetting, setSetting } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { sendMail } from "@/lib/mailer";

const KEYS = ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from", "smtp_secure"];

export async function GET() {
  const u = await requireAdmin();
  if (u instanceof NextResponse) return u;
  const out: Record<string, string | null> = {};
  for (const k of KEYS) {
    out[k] = k === "smtp_password" ? (getSetting(k) ? "***" : null) : getSetting(k);
  }
  return NextResponse.json(out);
}

const schema = z.object({
  smtp_host: z.string().optional(),
  smtp_port: z.string().optional(),
  smtp_user: z.string().optional(),
  smtp_password: z.string().optional(),
  smtp_from: z.string().optional(),
  smtp_secure: z.string().optional(),
});

export async function PATCH(req: Request) {
  const u = await requireAdmin();
  if (u instanceof NextResponse) return u;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === undefined) continue;
    // Don't overwrite password if "***" (placeholder)
    if (k === "smtp_password" && v === "***") continue;
    setSetting(k, v);
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  // Test-Mail
  const u = await requireAdmin();
  if (u instanceof NextResponse) return u;
  const body = await req.json().catch(() => null) as { to?: string } | null;
  const to = body?.to || u.email;
  const r = await sendMail({
    to,
    subject: "NexRedirect — SMTP-Test",
    html: `<p>Test-Mail von NexRedirect.</p><p>Wenn du das liest, läuft SMTP korrekt.</p>`,
  });
  // Use db to silence unused-import (no-op)
  void getDb;
  return NextResponse.json(r);
}
