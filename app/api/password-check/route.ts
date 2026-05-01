import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { validatePassword } from "@/lib/passwords";
import { checkLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // Public during setup, otherwise authed. Rate-limit either way.
  const session = await getServerSession(authOptions);
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";
  const limit = checkLimit(`pwcheck:${session?.user?.id ?? ip}`, 30, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null) as { password?: string } | null;
  if (!body?.password) return NextResponse.json({ ok: false, reason: "Passwort leer." });

  const result = await validatePassword(body.password);
  return NextResponse.json(result);
}
