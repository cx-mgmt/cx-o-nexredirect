import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { checkRedirectChain } from "@/lib/chain-check";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const row = getDb()
    .prepare("SELECT target_url FROM domains WHERE id = ?")
    .get(Number(id)) as { target_url: string | null } | undefined;

  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!row.target_url) return NextResponse.json({ is_chain: false, hops: 0 });

  return NextResponse.json(await checkRedirectChain(row.target_url));
}
