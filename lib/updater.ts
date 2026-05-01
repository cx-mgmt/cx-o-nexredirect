import { exec } from "child_process";
import { promisify } from "util";
import { getSetting, setSetting, getDb } from "./db";
import pkg from "../package.json";

const execAsync = promisify(exec);

const REPO = process.env.NEXREDIRECT_REPO || "CoreXManagement/CoreX-NexRedirect";

export type ReleaseInfo = {
  tag_name: string;
  name: string;
  html_url: string;
  prerelease: boolean;
  published_at: string;
};

export type UpdateStatus = {
  current: string;
  latest: string | null;
  update_available: boolean;
  release_url?: string;
  last_check?: number;
  auto_update: boolean;
  include_prereleases: boolean;
};

function cmpVersions(a: string, b: string): number {
  const norm = (v: string) => v.replace(/^v/, "").split(/[.-]/).map((p) => /^\d+$/.test(p) ? Number(p) : p);
  const aa = norm(a), bb = norm(b);
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
    const x = aa[i] ?? 0, y = bb[i] ?? 0;
    if (typeof x === "number" && typeof y === "number") {
      if (x !== y) return x - y;
    } else if (String(x) !== String(y)) {
      return String(x) < String(y) ? -1 : 1;
    }
  }
  return 0;
}

export async function fetchLatestRelease(includePrerelease = false): Promise<ReleaseInfo | null> {
  const url = includePrerelease
    ? `https://api.github.com/repos/${REPO}/releases?per_page=10`
    : `https://api.github.com/repos/${REPO}/releases/latest`;
  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/vnd.github+json", "User-Agent": "corex-nexredirect" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.find((r: ReleaseInfo) => includePrerelease || !r.prerelease) || null;
    }
    return data as ReleaseInfo;
  } catch {
    return null;
  }
}

export async function checkForUpdate(): Promise<UpdateStatus> {
  const current = pkg.version;
  const includePrereleases = getSetting("update_include_prereleases") === "true";
  const release = await fetchLatestRelease(includePrereleases);

  const latest = release?.tag_name ?? null;
  const update_available = !!latest && cmpVersions(current, latest) < 0;

  setSetting("latest_version", latest ?? "");
  setSetting("update_available", update_available ? "true" : "false");
  setSetting("update_last_check", String(Date.now()));
  if (release?.html_url) setSetting("update_release_url", release.html_url);

  return {
    current,
    latest,
    update_available,
    release_url: release?.html_url,
    last_check: Date.now(),
    auto_update: getSetting("update_auto") === "true",
    include_prereleases: includePrereleases,
  };
}

export function getUpdateStatus(): UpdateStatus {
  const current = pkg.version;
  const latest = getSetting("latest_version") || null;
  const update_available = !!latest && cmpVersions(current, latest) < 0;
  return {
    current,
    latest,
    update_available,
    release_url: getSetting("update_release_url") || undefined,
    last_check: Number(getSetting("update_last_check") || 0) || undefined,
    auto_update: getSetting("update_auto") === "true",
    include_prereleases: getSetting("update_include_prereleases") === "true",
  };
}

export async function applyUpdate(): Promise<{ ok: boolean; from: string; to: string | null; error?: string }> {
  const from = pkg.version;
  const status = await checkForUpdate();
  const to = status.latest;
  if (!to || !status.update_available) {
    return { ok: false, from, to, error: "no_update" };
  }

  const updateScript = process.env.NEXREDIRECT_UPDATE_SCRIPT || "/opt/corex-nexredirect/scripts/update.sh";
  const start = Date.now();
  try {
    const { stdout, stderr } = await execAsync(`sudo -n ${updateScript} ${to}`, { timeout: 5 * 60 * 1000 });
    getDb().prepare("INSERT INTO update_log (from_version, to_version, ts, status, log) VALUES (?, ?, ?, 'success', ?)")
      .run(from, to, start, (stdout + "\n" + stderr).slice(0, 10000));
    return { ok: true, from, to };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    getDb().prepare("INSERT INTO update_log (from_version, to_version, ts, status, log) VALUES (?, ?, ?, 'failed', ?)")
      .run(from, to, start, msg.slice(0, 10000));
    return { ok: false, from, to, error: msg };
  }
}
