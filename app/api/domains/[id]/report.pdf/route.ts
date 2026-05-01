import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, type DomainRow } from "@/lib/db";
import { createPdfToken } from "@/lib/pdf-token";

const CHROME_PATHS = [
  process.env.NEXREDIRECT_CHROME_PATH,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
].filter(Boolean) as string[];

async function findChrome(): Promise<string | null> {
  for (const p of CHROME_PATHS) {
    try { await fs.access(p); return p; } catch {}
  }
  return null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const row = getDb().prepare("SELECT * FROM domains WHERE id = ?").get(Number(id)) as DomainRow | undefined;
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const chrome = await findChrome();
  if (!chrome) return NextResponse.json({ error: "chrome_not_found" }, { status: 500 });

  const token = createPdfToken({ domain_id: String(row.id), title: `Report: ${row.domain}`, kind: "domain" }, 90);
  const port = process.env.PORT || "3000";
  const url = `http://127.0.0.1:${port}/r/${token}`;

  try {
    const puppeteer = await import("puppeteer-core");
    const browser = await puppeteer.default.launch({ executablePath: chrome, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"], headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle0", timeout: 30_000 });
      await page.waitForFunction(() => document.body.dataset.pdfReady === "1", { timeout: 10_000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 500));
      const buf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
      const filename = `nexredirect-${row.domain}-${new Date().toISOString().slice(0, 10)}.pdf`;
      return new NextResponse(buf as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (e) {
    return NextResponse.json({ error: "pdf_render_failed", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
