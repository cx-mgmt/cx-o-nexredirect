import { getDb, hashIp } from "./db";
import { lookupCountry } from "./geo";

type PendingHit = {
  domain_id: number;
  ts: number;
  ip_hash: string;
  country: string | null;
  user_agent: string | null;
  referer: string | null;
  path: string | null;
};

const buffer: PendingHit[] = [];
let flushTimer: NodeJS.Timeout | null = null;

function flush() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);
  try {
    const db = getDb();
    const stmt = db.prepare(
      "INSERT INTO hits (domain_id, ts, ip_hash, country, user_agent, referer, path) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    db.transaction(() => {
      for (const h of batch) {
        stmt.run(h.domain_id, h.ts, h.ip_hash, h.country, h.user_agent, h.referer, h.path);
      }
    })();
  } catch (e) {
    console.error("[hits] flush failed", e);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, 5000);
}

export async function recordHit(input: {
  domain_id: number;
  ip: string;
  user_agent: string | null;
  referer: string | null;
  path: string | null;
}) {
  const country = await lookupCountry(input.ip).catch(() => null);
  buffer.push({
    domain_id: input.domain_id,
    ts: Date.now(),
    ip_hash: hashIp(input.ip),
    country,
    user_agent: input.user_agent ? input.user_agent.slice(0, 500) : null,
    referer: input.referer ? input.referer.slice(0, 500) : null,
    path: input.path ? input.path.slice(0, 500) : null,
  });
  if (buffer.length >= 100) flush();
  else scheduleFlush();
}

export function flushHitsSync() {
  flush();
}
