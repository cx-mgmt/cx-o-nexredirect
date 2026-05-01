import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ALL_SCOPES, generateToken, type Scope } from "@/lib/api-auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const tokens = getDb()
    .prepare("SELECT id, name, scopes, created_at, last_used_at, revoked_at FROM api_tokens ORDER BY created_at DESC")
    .all();
  return NextResponse.json({ tokens });
}

const schema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(ALL_SCOPES as [Scope, ...Scope[]])).min(1),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });

  const { plaintext, hash } = generateToken();
  const result = getDb()
    .prepare("INSERT INTO api_tokens (name, token_hash, scopes, created_by, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(parsed.data.name, hash, JSON.stringify(parsed.data.scopes), Number(session.user.id), Date.now());

  return NextResponse.json({ id: result.lastInsertRowid, token: plaintext, name: parsed.data.name, scopes: parsed.data.scopes }, { status: 201 });
}
