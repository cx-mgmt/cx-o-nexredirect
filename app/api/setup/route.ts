import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb, isSetupComplete, setSetting, getDailySalt } from "@/lib/db";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  baseDomain: z.string().optional(),
});

export async function POST(req: Request) {
  if (isSetupComplete()) {
    return NextResponse.json({ error: "Setup already complete" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password, baseDomain } = parsed.data;
  const password_hash = await bcrypt.hash(password, 12);
  const now = Date.now();

  const db = getDb();
  db.transaction(() => {
    db.prepare("INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, 'admin', ?)")
      .run(email.toLowerCase().trim(), password_hash, now);
    if (baseDomain) setSetting("base_domain", baseDomain.trim());
    setSetting("setup_complete", "true");
  })();

  getDailySalt();

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ setup_complete: isSetupComplete() });
}
