import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkForUpdate, getUpdateStatus } from "@/lib/updater";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const force = new URL(req.url).searchParams.get("force") === "1";
  const status = force ? await checkForUpdate() : getUpdateStatus();
  if (!force && (!status.last_check || Date.now() - status.last_check > 60 * 60 * 1000)) {
    return NextResponse.json(await checkForUpdate());
  }
  return NextResponse.json(status);
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await checkForUpdate());
}
