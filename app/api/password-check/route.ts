import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { validatePassword } from "@/lib/passwords";
import { checkLimit } from "@/lib/rate-limit";
import { isSetupComplete } from "@/lib/db";

export async function POST(req: Request) {
  // Waehrend der Ersteinrichtung noch ohne Sitzung, danach nur angemeldet.
  const session = await getServerSession(authOptions);
  if (!session && isSetupComplete()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";
  const limit = checkLimit(`pwcheck:${session?.user?.id ?? ip}`, 30, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null) as { password?: string } | null;
  if (!body?.password) return NextResponse.json({ ok: false, reason: "Passwort leer." });

  const result = await validatePassword(body.password);
  return NextResponse.json(result);
}
