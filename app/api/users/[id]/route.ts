import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb, logAudit, type UserRow } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { validatePassword } from "@/lib/passwords";

const updateSchema = z.object({
  role: z.enum(["admin", "user"]).optional(),
  password: z.string().min(10).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireAdmin();
  if (u instanceof NextResponse) return u;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const db = getDb();
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(id)) as UserRow | undefined;
  if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const fields: string[] = [];
  const values: unknown[] = [];
  if (parsed.data.role) {
    // Don't allow demoting the last admin
    if (parsed.data.role === "user" && target.role === "admin") {
      const adminCount = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get() as { n: number }).n;
      if (adminCount <= 1) return NextResponse.json({ error: "last_admin", code: "cannot_demote_last_admin" }, { status: 409 });
    }
    fields.push("role = ?");
    values.push(parsed.data.role);
  }
  if (parsed.data.password) {
    const pwdCheck = await validatePassword(parsed.data.password);
    if (!pwdCheck.ok) return NextResponse.json({ error: "weak_password", reason: pwdCheck.reason }, { status: 400 });
    const hash = await bcrypt.hash(parsed.data.password, 12);
    fields.push("password_hash = ?");
    values.push(hash);
  }
  if (fields.length === 0) return NextResponse.json({ ok: true, noop: true });

  values.push(Number(id));
  db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  logAudit({ user_id: Number(u.id), user_email: u.email, action: "user.update", target_type: "user", target_id: target.id, details: { fields: Object.keys(parsed.data) } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireAdmin();
  if (u instanceof NextResponse) return u;
  const { id } = await params;

  if (Number(id) === Number(u.id)) return NextResponse.json({ error: "cannot_delete_self" }, { status: 409 });

  const db = getDb();
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(id)) as UserRow | undefined;
  if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (target.role === "admin") {
    const adminCount = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get() as { n: number }).n;
    if (adminCount <= 1) return NextResponse.json({ error: "last_admin" }, { status: 409 });
  }

  db.prepare("DELETE FROM users WHERE id = ?").run(Number(id));
  logAudit({ user_id: Number(u.id), user_email: u.email, action: "user.delete", target_type: "user", target_id: target.id, details: { email: target.email } });
  return NextResponse.json({ ok: true });
}
