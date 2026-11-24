import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { getDb, getSetting, logAudit, type UserRow } from "@/lib/db";
import { sendMail, getSmtpConfig } from "@/lib/mailer";
import { checkLimit } from "@/lib/rate-limit";

const schema = z.object({
  identifier: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";
  const ipLimit = checkLimit(`forgot:ip:${ip}`, 5, 60 * 60 * 1000);
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const id = parsed.data.identifier.toLowerCase().trim();
  const idLimit = checkLimit(`forgot:id:${id}`, 3, 60 * 60 * 1000);
  if (!idLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1").get(id, id) as UserRow | undefined;

  // Immer dieselbe Antwort, sonst verraten SMTP-Status und Versandfehler, ob das Konto existiert.
  if (!user || !getSmtpConfig()) {
    await new Promise((r) => setTimeout(r, 300));
    return NextResponse.json({ ok: true });
  }

  // Generate token (raw → URL; hash → DB)
  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = Date.now() + 60 * 60 * 1000; // 60 min

  db.prepare("INSERT INTO password_resets (user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(user.id, tokenHash, Date.now(), expiresAt);

  const baseDomain = getSetting("base_domain");
  const proto = baseDomain ? "https" : "http";
  const host = baseDomain || (getSetting("server_ip") || "localhost");
  const link = `${proto}://${host}/reset/${raw}`;

  const subject = "NexRedirect — Passwort zurücksetzen";
  const html = `
    <p>Hallo,</p>
    <p>Du (oder jemand mit Kenntnis deines Accounts) hat ein Passwort-Reset für <strong>${user.email}</strong> bei NexRedirect angefordert.</p>
    <p><a href="${link}">→ Neues Passwort setzen</a></p>
    <p>Der Link ist <strong>60 Minuten</strong> gültig und kann nur einmal verwendet werden.</p>
    <p style="color:#666;font-size:12px">Falls du das nicht warst, ignoriere diese Mail. Niemand erhält Zugriff ohne den Link.</p>
  `;

  const result = await sendMail({ to: user.email, subject, html });
  if (!result.ok) {
    logAudit({ user_id: user.id, user_email: user.email, action: "auth.forgot_send_failed", target_type: "user", target_id: user.id, details: { error: result.error } });
    return NextResponse.json({ ok: true });
  }

  logAudit({ user_id: user.id, user_email: user.email, action: "auth.forgot", target_type: "user", target_id: user.id });
  return NextResponse.json({ ok: true });
}
