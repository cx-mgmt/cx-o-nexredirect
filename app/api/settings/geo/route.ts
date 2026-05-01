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
  account_id: z.string().optional(),
});

type DownloadResult = { ok: true; body: Buffer } | { ok: false; status: number; text: string };

async function tryDownload(url: string, headers: Record<string, string> = {}): Promise<DownloadResult> {
  const res = await fetch(url, { headers: { "User-Agent": "corex-nexredirect", ...headers } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, text: text.slice(0, 500) };
  }
  const ct = res.headers.get("content-type") || "";
  const buf = Buffer.from(await res.arrayBuffer());
  if (ct.includes("text/html") || buf.slice(0, 4).toString() === "<htm" || buf.slice(0, 5).toString() === "<!DOC") {
    return { ok: false, status: 200, text: "Server returned HTML, not tar.gz (likely auth failure or EULA not accepted)" };
  }
  return { ok: true, body: buf };
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "forbidden", code: "admin_required" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { license_key, account_id } = parsed.data;

  const attempts: Array<{ url: string; headers?: Record<string, string>; label: string }> = [];

  if (account_id) {
    const auth = Buffer.from(`${account_id}:${license_key}`).toString("base64");
    attempts.push({
      url: "https://download.maxmind.com/geoip/databases/GeoLite2-Country/download?suffix=tar.gz",
      headers: { Authorization: `Basic ${auth}` },
      label: "basic-auth",
    });
  }
  attempts.push({
    url: `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-Country&license_key=${encodeURIComponent(license_key)}&suffix=tar.gz`,
    label: "legacy",
  });

  let lastErr: { status: number; text: string; label: string } | null = null;
  let buf: Buffer | null = null;
  for (const a of attempts) {
    const r = await tryDownload(a.url, a.headers);
    if (r.ok) { buf = r.body; break; }
    lastErr = { status: r.status, text: r.text, label: a.label };
  }

  if (!buf) {
    return NextResponse.json({
      error: "download_failed",
      detail: lastErr?.text || "no detail",
      status: lastErr?.status,
      hint: account_id
        ? "MaxMind hat das Tarball nicht ausgeliefert. Stimmen Account-ID und License-Key? GeoLite2 muss im Account aktiviert sein und EULA akzeptiert."
        : "Falls dein License-Key über das neue MaxMind-Account-System erstellt wurde, ist die Account-ID nötig (siehe Account → My License Keys oder unter Account-Details).",
    }, { status: 502 });
  }

  try {
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
  if (session.user.role !== "admin") return NextResponse.json({ error: "forbidden", code: "admin_required" }, { status: 403 });
  await fs.unlink(MMDB_PATH).catch(() => {});
  resetGeoReader();
  return NextResponse.json({ ok: true });
}
