import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPdfToken } from "@/lib/pdf-token";

const CHROME_PATHS = [
  process.env.NEXREDIRECT_CHROME_PATH,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
].filter(Boolean) as string[];

async function findChrome(): Promise<string | null> {
  const fs = await import("fs/promises");
  for (const p of CHROME_PATHS) {
    try {
      await fs.access(p);
      return p;
    } catch {}
  }
  return null;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const params: Record<string, string> = {};
  for (const k of ["days", "title", "summary", "daily", "top", "country", "perDomain", "dead", "hits"]) {
    const v = url.searchParams.get(k);
    if (v !== null) params[k] = v;
  }

  const chromePath = await findChrome();
  if (!chromePath) {
    return NextResponse.json({
      error: "chrome_not_found",
      hint: "Chromium nicht installiert. Auf dem Server: sudo apt install -y chromium",
    }, { status: 500 });
  }

  const token = createPdfToken(params, 90);
  const port = process.env.PORT || "3000";
  const reportUrl = `http://127.0.0.1:${port}/r/${token}`;

  try {
    const puppeteer = await import("puppeteer-core");
    const browser = await puppeteer.default.launch({
      executablePath: chromePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      headless: true,
    });

    try {
      const page = await browser.newPage();
      await page.goto(reportUrl, { waitUntil: "networkidle0", timeout: 30_000 });
      // Wait until ReportClient signals readiness (charts mounted)
      await page.waitForFunction(() => document.body.dataset.pdfReady === "1", { timeout: 10_000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 500));

      const buf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });

      const filename = `nexredirect-report-${new Date().toISOString().slice(0, 10)}.pdf`;
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
