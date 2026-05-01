import { NextResponse } from "next/server";
import { getUpdateStatus } from "@/lib/updater";

export async function GET() {
  return NextResponse.json(getUpdateStatus());
}
