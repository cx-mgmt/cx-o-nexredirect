import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getDb, logAudit, type UserRow } from "@/lib/db";
import { validatePassword } from "@/lib/passwords";
import { checkLimit } from "@/lib/rate-limit";

const schema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(10),
});

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";
  const rl = checkLimit(`reset:ip:${ip}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
  const db = getDb();
  const reset = db.prepare("SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ? LIMIT 1").get(tokenHash) as
    | { id: number; user_id: number; expires_at: number; used_at: number | null } | undefined;

  if (!reset || reset.used_at !== null || reset.expires_at < Date.now()) {
    return NextResponse.json({ error: "invalid_or_expired" }, { status: 400 });
  }

  const pwdCheck = await validatePassword(parsed.data.password);
  if (!pwdCheck.ok) return NextResponse.json({ error: "weak_password", reason: pwdCheck.reason }, { status: 400 });

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(reset.user_id) as UserRow | undefined;
  if (!user) return NextResponse.json({ error: "user_gone" }, { status: 400 });

  const hash = await bcrypt.hash(parsed.data.password, 12);
  db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, user.id);
    db.prepare("UPDATE password_resets SET used_at = ? WHERE id = ?").run(Date.now(), reset.id);
    // Invalidate all OTHER outstanding resets for this user
    db.prepare("UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL").run(Date.now(), user.id);
  })();

  logAudit({ user_id: user.id, user_email: user.email, action: "auth.reset", target_type: "user", target_id: user.id });
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  // Token-validity check (for the /reset/[token] page)
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ valid: false });
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const reset = getDb().prepare("SELECT expires_at, used_at FROM password_resets WHERE token_hash = ? LIMIT 1").get(tokenHash) as { expires_at: number; used_at: number | null } | undefined;
  return NextResponse.json({ valid: !!reset && reset.used_at === null && reset.expires_at > Date.now() });
}
