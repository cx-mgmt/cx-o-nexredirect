import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const DATA_DIR = process.env.NEXREDIRECT_DATA_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "nexredirect.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  _db = db;
  return db;
}

function ensureSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS domain_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_url TEXT NOT NULL,
      redirect_code INTEGER NOT NULL DEFAULT 302,
      created_by INTEGER REFERENCES users(id),
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      target_url TEXT,
      group_id INTEGER REFERENCES domain_groups(id) ON DELETE SET NULL,
      redirect_code INTEGER NOT NULL DEFAULT 302,
      preserve_path INTEGER NOT NULL DEFAULT 1,
      include_www INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id),
      created_at INTEGER NOT NULL,
      verified_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);

    CREATE TABLE IF NOT EXISTS hits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
      ts INTEGER NOT NULL,
      ip_hash TEXT NOT NULL,
      country TEXT,
      user_agent TEXT,
      referer TEXT,
      path TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_hits_domain_ts ON hits(domain_id, ts);
    CREATE INDEX IF NOT EXISTS idx_hits_ts ON hits(ts);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      scopes TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at INTEGER NOT NULL,
      last_used_at INTEGER,
      revoked_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS update_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_version TEXT,
      to_version TEXT,
      ts INTEGER NOT NULL,
      status TEXT NOT NULL,
      log TEXT
    );
  `);

  runMigrations(db);
}

function getSettingDirect(db: Database.Database, key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}
function setSettingDirect(db: Database.Database, key: string, value: string) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

function runMigrations(db: Database.Database) {
  // m_301_to_302: switch existing 301-redirects to 302 so browser-cache stops eating hits.
  if (getSettingDirect(db, "m_301_to_302") !== "done") {
    db.prepare("UPDATE domains SET redirect_code = 302 WHERE redirect_code = 301").run();
    db.prepare("UPDATE domain_groups SET redirect_code = 302 WHERE redirect_code = 301").run();
    setSettingDirect(db, "m_301_to_302", "done");
  }
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

export function isSetupComplete(): boolean {
  return getSetting("setup_complete") === "true";
}

export function getDailySalt(): string {
  const today = new Date().toISOString().slice(0, 10);
  const stored = getSetting("daily_ip_salt");
  if (stored) {
    const [date, salt] = stored.split("|");
    if (date === today) return salt;
  }
  const salt = crypto.randomBytes(16).toString("hex");
  setSetting("daily_ip_salt", `${today}|${salt}`);
  return salt;
}

export function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip + getDailySalt()).digest("hex");
}

export type SunsetConfig = {
  enabled: boolean;
  title?: string;
  message?: string;
  button_label?: string;
  sunset_date?: string;
};

export type DomainRow = {
  id: number;
  domain: string;
  status: "pending" | "active" | "error";
  target_url: string | null;
  group_id: number | null;
  redirect_code: number;
  preserve_path: number;
  include_www: number;
  created_by: number | null;
  created_at: number;
  verified_at: number | null;
  sunset_config: string | null;
};

export function parseSunset(row: { sunset_config?: string | null }): SunsetConfig | null {
  if (!row.sunset_config) return null;
  try {
    const parsed = JSON.parse(row.sunset_config) as SunsetConfig;
    return parsed.enabled ? parsed : null;
  } catch {
    return null;
  }
}

export type DomainGroupRow = {
  id: number;
  name: string;
  target_url: string;
  redirect_code: number;
  created_by: number | null;
  created_at: number;
};

export type UserRow = {
  id: number;
  email: string;
  password_hash: string;
  role: string;
  created_at: number;
};

export type ApiTokenRow = {
  id: number;
  name: string;
  token_hash: string;
  scopes: string;
  created_by: number | null;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
};
