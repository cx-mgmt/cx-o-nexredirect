import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import QRCode from "qrcode";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const row = getDb()
    .prepare("SELECT domain FROM domains WHERE id = ?")
    .get(Number(id)) as { domain: string } | undefined;

  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const svg = await QRCode.toString(`https://${row.domain}`, {
    type: "svg",
    margin: 2,
    color: { dark: "#ffffff", light: "#09090b" },
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="${row.domain}-qr.svg"`,
      "Cache-Control": "no-cache",
    },
  });
}
