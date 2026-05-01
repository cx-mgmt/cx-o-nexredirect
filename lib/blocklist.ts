import { getDb } from "./db";

// Resilient: never throw — if table missing, treat as "not blocked / no-op"
// so a redirect path is never broken by blocklist plumbing.

function ensureTable() {
  try {
    getDb().exec(`
      CREATE TABLE IF NOT EXISTS ip_blocklist (
        ip_hash TEXT PRIMARY KEY,
        blocked_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        reason TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_blocklist_expires ON ip_blocklist(expires_at);
    `);
  } catch {}
}

let tableEnsured = false;
function ensureOnce() {
  if (tableEnsured) return;
  ensureTable();
  tableEnsured = true;
}

export function isBlocked(ipHash: string): boolean {
  try {
    ensureOnce();
    const row = getDb().prepare("SELECT 1 FROM ip_blocklist WHERE ip_hash = ? AND expires_at > ?").get(ipHash, Date.now());
    return !!row;
  } catch {
    return false;
  }
}

export function block(ipHash: string, hours = 24, reason = "scanner") {
  try {
    ensureOnce();
    const expiresAt = Date.now() + hours * 60 * 60 * 1000;
    getDb()
      .prepare("INSERT INTO ip_blocklist (ip_hash, blocked_at, expires_at, reason) VALUES (?, ?, ?, ?) ON CONFLICT(ip_hash) DO UPDATE SET expires_at = excluded.expires_at, reason = excluded.reason")
      .run(ipHash, Date.now(), expiresAt, reason);
  } catch {}
}

export function unblock(ipHash: string) {
  try { ensureOnce(); getDb().prepare("DELETE FROM ip_blocklist WHERE ip_hash = ?").run(ipHash); } catch {}
}

export function listBlocked(): { ip_hash: string; blocked_at: number; expires_at: number; reason: string }[] {
  try {
    ensureOnce();
    return getDb().prepare("SELECT ip_hash, blocked_at, expires_at, reason FROM ip_blocklist WHERE expires_at > ? ORDER BY blocked_at DESC").all(Date.now()) as { ip_hash: string; blocked_at: number; expires_at: number; reason: string }[];
  } catch { return []; }
}
