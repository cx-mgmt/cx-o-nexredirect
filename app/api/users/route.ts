import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb, logAudit, type UserRow } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { validatePassword } from "@/lib/passwords";

export async function GET() {
  const u = await requireAdmin();
  if (u instanceof NextResponse) return u;
  const rows = getDb().prepare("SELECT id, email, role, created_at FROM users ORDER BY created_at").all();
  return NextResponse.json({ users: rows });
}

const createSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(10),
  role: z.enum(["admin", "user"]).default("user"),
});

export async function POST(req: Request) {
  const u = await requireAdmin();
  if (u instanceof NextResponse) return u;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });

  const db = getDb();
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(parsed.data.email)) {
    return NextResponse.json({ error: "email_exists" }, { status: 409 });
  }
  const pwdCheck = await validatePassword(parsed.data.password);
  if (!pwdCheck.ok) return NextResponse.json({ error: "weak_password", reason: pwdCheck.reason }, { status: 400 });
  const hash = await bcrypt.hash(parsed.data.password, 12);
  const result = db.prepare("INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)").run(parsed.data.email, hash, parsed.data.role, Date.now());
  const row = db.prepare("SELECT id, email, role, created_at FROM users WHERE id = ?").get(result.lastInsertRowid) as UserRow;
  logAudit({ user_id: Number(u.id), user_email: u.email, action: "user.create", target_type: "user", target_id: row.id, details: { email: row.email, role: row.role } });
  return NextResponse.json({ user: row }, { status: 201 });
}
