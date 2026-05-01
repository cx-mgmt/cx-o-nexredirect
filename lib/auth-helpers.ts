import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";

export type SessionUser = { id: string; email: string; role: string };

export async function requireSession(): Promise<SessionUser | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return session.user as SessionUser;
}

export async function requireAdmin(): Promise<SessionUser | NextResponse> {
  const u = await requireSession();
  if (u instanceof NextResponse) return u;
  if (u.role !== "admin") return NextResponse.json({ error: "forbidden", code: "admin_required" }, { status: 403 });
  return u;
}
