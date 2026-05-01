// Boot-time background job runner. Started once from server.ts after Next.js prepare().
import { getDb, getSetting } from "./db";
import { checkDomainDns } from "./dns";
import { reloadCaddy } from "./caddy";
import { invalidateRedirectCache } from "./redirect-resolver";

let started = false;
const timers: NodeJS.Timeout[] = [];

function schedule(fn: () => void | Promise<void>, intervalMs: number, immediate = false) {
  if (immediate) Promise.resolve(fn()).catch((e) => console.error("[job] error", e));
  const t = setInterval(() => {
    Promise.resolve(fn()).catch((e) => console.error("[job] error", e));
  }, intervalMs);
  t.unref?.();
  timers.push(t);
}

async function pruneHits() {
  const days = Number(getSetting("hits_retention_days") || 365);
  if (!Number.isFinite(days) || days <= 0) return;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const result = getDb().prepare("DELETE FROM hits WHERE ts < ?").run(cutoff);
  if (result.changes > 0) {
    console.log(`[job:hits-retention] pruned ${result.changes} hits older than ${days}d`);
  }
}

async function pruneAuditLog() {
  // keep last 5000 entries
  getDb().exec(`DELETE FROM audit_log WHERE id NOT IN (SELECT id FROM audit_log ORDER BY id DESC LIMIT 5000)`);
}

async function dnsHealthCheck() {
  const db = getDb();
  const rows = db.prepare("SELECT id, domain, include_www, status FROM domains WHERE status IN ('active','error')").all() as { id: number; domain: string; include_www: number; status: string }[];
  let changed = 0;
  for (const d of rows) {
    try {
      const r = await checkDomainDns(d.domain, !!d.include_www);
      if (r.ok && d.status !== "active") {
        db.prepare("UPDATE domains SET status='active', verified_at=? WHERE id=?").run(Date.now(), d.id);
        changed++;
      } else if (!r.ok && d.status === "active") {
        db.prepare("UPDATE domains SET status='error' WHERE id=?").run(d.id);
        changed++;
      }
    } catch {
      // ignore individual lookup failures
    }
  }
  if (changed > 0) {
    invalidateRedirectCache();
    reloadCaddy().catch(() => {});
    console.log(`[job:dns-health] status changed for ${changed} domains`);
  }
}

async function pruneIpBlocklist() {
  // Auto-expire entries older than 24h
  getDb().prepare("DELETE FROM ip_blocklist WHERE expires_at < ?").run(Date.now());
}

export function startJobs() {
  if (started) return;
  started = true;

  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  // Hits retention: daily
  schedule(pruneHits, DAY);
  // Audit-log retention: daily
  schedule(pruneAuditLog, DAY);
  // DNS health check: every 6h, first run after 5min boot to give DNS time
  setTimeout(() => {
    dnsHealthCheck().catch(() => {});
    schedule(dnsHealthCheck, 6 * HOUR);
  }, 5 * 60 * 1000);
  // IP blocklist cleanup: hourly
  schedule(pruneIpBlocklist, HOUR);

  console.log("[jobs] background jobs started");
}

export function stopJobs() {
  for (const t of timers) clearInterval(t);
  timers.length = 0;
  started = false;
}
