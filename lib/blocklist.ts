import { getDb } from "./db";

export function isBlocked(ipHash: string): boolean {
  const row = getDb().prepare("SELECT 1 FROM ip_blocklist WHERE ip_hash = ? AND expires_at > ?").get(ipHash, Date.now());
  return !!row;
}

export function block(ipHash: string, hours = 24, reason = "scanner") {
  const expiresAt = Date.now() + hours * 60 * 60 * 1000;
  getDb()
    .prepare("INSERT INTO ip_blocklist (ip_hash, blocked_at, expires_at, reason) VALUES (?, ?, ?, ?) ON CONFLICT(ip_hash) DO UPDATE SET expires_at = excluded.expires_at, reason = excluded.reason")
    .run(ipHash, Date.now(), expiresAt, reason);
}

export function unblock(ipHash: string) {
  getDb().prepare("DELETE FROM ip_blocklist WHERE ip_hash = ?").run(ipHash);
}

export function listBlocked(): { ip_hash: string; blocked_at: number; expires_at: number; reason: string }[] {
  return getDb().prepare("SELECT ip_hash, blocked_at, expires_at, reason FROM ip_blocklist WHERE expires_at > ? ORDER BY blocked_at DESC").all(Date.now()) as { ip_hash: string; blocked_at: number; expires_at: number; reason: string }[];
}
