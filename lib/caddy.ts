import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { getDb, getSetting, type DomainRow, type DomainGroupRow } from "./db";

const execAsync = promisify(exec);

const CADDYFILE_PATH = process.env.NEXREDIRECT_CADDYFILE || "/etc/caddy/Caddyfile";
const CADDY_ADMIN = process.env.CADDY_ADMIN_URL || "http://localhost:2019";
const APP_PORT = process.env.PORT || "3000";

export function buildCaddyfile(): string {
  const db = getDb();
  const baseDomain = getSetting("base_domain");
  const adminEmail = getSetting("admin_email") || "admin@example.com";

  const domains = db.prepare("SELECT * FROM domains WHERE status = 'active'").all() as DomainRow[];
  const groups = db.prepare("SELECT * FROM domain_groups").all() as DomainGroupRow[];
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  const lines: string[] = [];
  lines.push(`{`);
  lines.push(`  email ${adminEmail}`);
  lines.push(`}`);
  lines.push(``);

  // Admin-UI
  const adminHosts: string[] = [":80"];
  if (baseDomain) adminHosts.push(baseDomain);
  lines.push(`${adminHosts.join(", ")} {`);
  lines.push(`  reverse_proxy localhost:${APP_PORT}`);
  lines.push(`}`);
  lines.push(``);

  // Per-Domain redirect blocks → reverse_proxy to app for hit logging
  for (const d of domains) {
    if (baseDomain && d.domain === baseDomain) continue;
    const hosts = [d.domain];
    if (d.include_www) hosts.push(`www.${d.domain}`);
    lines.push(`${hosts.join(", ")} {`);
    lines.push(`  reverse_proxy localhost:${APP_PORT}`);

    // Fallback redirect baked-in: if app is down, Caddy still redirects (no analytics)
    const fallbackTarget = d.target_url || (d.group_id ? groupMap.get(d.group_id)?.target_url : null);
    if (fallbackTarget) {
      const code = d.redirect_code || 301;
      const target = d.preserve_path ? `${fallbackTarget}{uri}` : fallbackTarget;
      lines.push(`  handle_errors {`);
      lines.push(`    redir ${target} ${code}`);
      lines.push(`  }`);
    }
    lines.push(`}`);
    lines.push(``);
  }

  return lines.join("\n");
}

export async function writeCaddyfile(): Promise<void> {
  const content = buildCaddyfile();
  await fs.mkdir(path.dirname(CADDYFILE_PATH), { recursive: true }).catch(() => {});
  await fs.writeFile(CADDYFILE_PATH, content, "utf8");
}

export async function reloadCaddy(): Promise<{ ok: boolean; error?: string }> {
  try {
    await writeCaddyfile();
  } catch (e) {
    return { ok: false, error: `write Caddyfile failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  // Try shell `caddy reload` first — it talks to admin API as caddy itself, no Origin-header issues.
  try {
    await execAsync(`caddy reload --config ${CADDYFILE_PATH} --address localhost:2019`, { timeout: 30_000 });
    return { ok: true };
  } catch (e) {
    // Fall back to direct admin API POST (older Caddy / different admin URL).
    try {
      const adapt = await fetch(`${CADDY_ADMIN}/load`, {
        method: "POST",
        headers: { "Content-Type": "text/caddyfile", Origin: "" },
        body: buildCaddyfile(),
      });
      if (!adapt.ok) {
        const text = await adapt.text().catch(() => "");
        return { ok: false, error: `caddy reload failed: ${e instanceof Error ? e.message : String(e)} | api fallback: ${adapt.status} ${text}` };
      }
      return { ok: true };
    } catch (e2) {
      return { ok: false, error: `caddy reload + api fallback both failed: ${e instanceof Error ? e.message : String(e)} ; ${e2 instanceof Error ? e2.message : String(e2)}` };
    }
  }
}
