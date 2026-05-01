import type { SunsetConfig } from "./db";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function renderSunsetPage(opts: {
  domain: string;
  target: string;
  preservePath: boolean;
  reqPath: string;
  cfg: SunsetConfig;
}): string {
  const title = opts.cfg.title || "Diese Domain wird abgeschaltet";
  const message = opts.cfg.message || `Die Domain ${opts.domain} wird abgeschaltet. Bitte aktualisiere deine Lesezeichen.`;
  const button = opts.cfg.button_label || "Weiter";
  const date = opts.cfg.sunset_date ? `Geplante Abschaltung: ${opts.cfg.sunset_date}` : "";

  const continueUrl = (() => {
    const sep = opts.target.includes("?") ? "&" : "?";
    const base = opts.preservePath ? opts.target + (opts.reqPath || "") : opts.target;
    // Avoid mangling paths that already have query — only append nothing extra; just go to target as-is
    return base;
  })();

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    background: #ffffff;
    color: #111;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    line-height: 1.6;
  }
  .card {
    max-width: 540px;
    width: 100%;
    text-align: center;
  }
  h1 { font-size: 22px; font-weight: 600; margin: 0 0 16px; color: #000; }
  p { font-size: 15px; color: #333; margin: 0 0 12px; white-space: pre-wrap; }
  .date { font-size: 13px; color: #666; margin: 16px 0 28px; }
  a.continue {
    display: inline-block;
    padding: 10px 24px;
    background: #111;
    color: #fff;
    text-decoration: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
  }
  a.continue:hover { background: #333; }
  .domain {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: #888;
    margin-top: 32px;
    word-break: break-all;
  }
</style>
</head>
<body>
  <div class="card">
    <h1>${esc(title)}</h1>
    <p>${esc(message)}</p>
    ${date ? `<p class="date">${esc(date)}</p>` : ""}
    <a class="continue" href="${esc(continueUrl)}?nr_continue=1">${esc(button)}</a>
    <p class="domain">${esc(opts.domain)} → ${esc(opts.target)}</p>
  </div>
</body>
</html>`;
}
