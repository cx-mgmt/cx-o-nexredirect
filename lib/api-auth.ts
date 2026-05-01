import crypto from "crypto";
import { NextResponse } from "next/server";
import { getDb, type ApiTokenRow } from "./db";
import { checkLimit } from "./rate-limit";

export type Scope = "read:domains" | "write:domains" | "read:analytics" | "read:hits";
export const ALL_SCOPES: Scope[] = ["read:domains", "write:domains", "read:analytics", "read:hits"];

export function generateToken(): { plaintext: string; hash: string } {
  const random = crypto.randomBytes(32).toString("hex");
  const plaintext = `nrx_${random}`;
  const hash = crypto.createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, hash };
}

function hashToken(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

export type AuthedToken = {
  id: number;
  name: string;
  scopes: Scope[];
};

export function authenticateToken(req: Request): AuthedToken | null {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token.startsWith("nrx_")) return null;

  const hash = hashToken(token);
  const row = getDb()
    .prepare("SELECT * FROM api_tokens WHERE token_hash = ? AND revoked_at IS NULL LIMIT 1")
    .get(hash) as ApiTokenRow | undefined;
  if (!row) return null;

  getDb().prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?").run(Date.now(), row.id);

  let scopes: Scope[] = [];
  try { scopes = JSON.parse(row.scopes); } catch {}
  return { id: row.id, name: row.name, scopes };
}

export function requireScope(req: Request, scope: Scope): AuthedToken | NextResponse {
  const t = authenticateToken(req);
  if (!t) {
    // Rate-limit by IP for unauth: 30 attempts / minute
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";
    const rl = checkLimit(`api:unauth:${ip}`, 30, 60_000);
    if (!rl.allowed) return NextResponse.json({ error: "rate_limited", retry_after: rl.retryAfterSec }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 60) } });
    return NextResponse.json({ error: "unauthorized", code: "no_token" }, { status: 401 });
  }
  // Per-token rate-limit: 60 / minute
  const rl = checkLimit(`api:token:${t.id}`, 60, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "rate_limited", retry_after: rl.retryAfterSec }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 60) } });
  if (!t.scopes.includes(scope)) {
    return NextResponse.json({ error: "forbidden", code: "missing_scope", required: scope }, { status: 403 });
  }
  return t;
}
