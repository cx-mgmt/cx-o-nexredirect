import { NextResponse } from "next/server";
import { z } from "zod";
import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resetGeoReader, geoStatus } from "@/lib/geo";

const DATA_DIR = process.env.NEXREDIRECT_DATA_DIR || path.join(process.cwd(), "data");
const MMDB_PATH = process.env.NEXREDIRECT_GEOIP_PATH || path.join(DATA_DIR, "GeoLite2-Country.mmdb");

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(geoStatus());
}

const schema = z.object({
  license_key: z.string().min(10),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const url = `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-Country&license_key=${encodeURIComponent(parsed.data.license_key)}&suffix=tar.gz`;

  try {
    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: "download_failed", status: res.status }, { status: 502 });
    const buf = Buffer.from(await res.arrayBuffer());
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "geo-"));
    const tarPath = path.join(tmpDir, "geo.tgz");
    await fs.writeFile(tarPath, buf);

    await new Promise<void>((resolve, reject) => {
      const p = spawn("tar", ["-xzf", tarPath, "-C", tmpDir]);
      p.on("error", reject);
      p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`tar exit ${code}`))));
    });

    const entries = await fs.readdir(tmpDir, { recursive: true }) as string[];
    const mmdb = entries.find((e) => e.endsWith("GeoLite2-Country.mmdb"));
    if (!mmdb) return NextResponse.json({ error: "mmdb_not_found_in_archive" }, { status: 500 });

    await fs.mkdir(path.dirname(MMDB_PATH), { recursive: true });
    await fs.copyFile(path.join(tmpDir, mmdb), MMDB_PATH);
    await fs.rm(tmpDir, { recursive: true, force: true });

    resetGeoReader();
    return NextResponse.json({ ok: true, path: MMDB_PATH });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await fs.unlink(MMDB_PATH).catch(() => {});
  resetGeoReader();
  return NextResponse.json({ ok: true });
}
