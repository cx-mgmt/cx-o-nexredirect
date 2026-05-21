import { NextResponse } from "next/server";
import { requireScope } from "@/lib/api-auth";
import { getUpdateStatus } from "@/lib/updater";

export async function GET(req: Request) {
  const auth = requireScope(req, "read:domains");
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(getUpdateStatus());
}
