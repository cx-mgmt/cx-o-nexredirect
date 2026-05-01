import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "forbidden", code: "admin_required" }, { status: 403 });
  const { id } = await params;
  getDb().prepare("UPDATE api_tokens SET revoked_at = ? WHERE id = ?").run(Date.now(), Number(id));
  return NextResponse.json({ ok: true });
}
