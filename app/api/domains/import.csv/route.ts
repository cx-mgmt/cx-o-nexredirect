import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, logAudit } from "@/lib/db";
import { isValidDomain } from "@/lib/dns";

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const sep = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const split = (l: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (inQ) {
        if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') { inQ = false; }
        else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === sep) { out.push(cur); cur = ""; }
        else cur += c;
      }
    }
    out.push(cur);
    return out;
  };
  const head = split(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((l) => {
    const cols = split(l);
    const r: Record<string, string> = {};
    head.forEach((h, i) => { r[h] = (cols[i] || "").trim(); });
    return r;
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "forbidden", code: "admin_required" }, { status: 403 });

  const text = await req.text();
  const rows = parseCsv(text);
  if (rows.length === 0) return NextResponse.json({ error: "empty_csv" }, { status: 400 });
  if (rows.length > 1000) return NextResponse.json({ error: "too_many", limit: 1000 }, { status: 400 });

  const db = getDb();
  const now = Date.now();
  const userId = Number(session.user.id);

  // Optional pre-resolve groups by name
  const groupNames = new Set(rows.map((r) => r.group).filter(Boolean));
  const groups = groupNames.size > 0
    ? (db.prepare(`SELECT id, name FROM domain_groups WHERE name IN (${Array.from(groupNames).map(() => "?").join(",")})`).all(...Array.from(groupNames)) as { id: number; name: string }[])
    : [];
  const groupByName = new Map(groups.map((g) => [g.name, g.id]));

  const insert = db.prepare(`INSERT INTO domains (domain, status, target_url, group_id, redirect_code, preserve_path, include_www, created_by, created_at) VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?)`);

  let imported = 0;
  const errors: { row: number; domain: string; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const domain = (r.domain || r.host || "").toLowerCase().trim();
    if (!domain) continue;
    if (!isValidDomain(domain)) { errors.push({ row: i + 2, domain, error: "invalid_domain" }); continue; }

    const targetUrl = (r.target_url || r.target || r.url || "").trim() || null;
    const groupName = (r.group || r.gruppe || "").trim();
    const groupId = groupName ? groupByName.get(groupName) ?? null : null;
    if (!targetUrl && !groupId) { errors.push({ row: i + 2, domain, error: "no_target" }); continue; }

    const code = Number(r.redirect_code || r.code || 302);
    const preserve = ![ "0", "false", "nein", "no" ].includes((r.preserve_path || r.preserve || "1").toLowerCase());
    const incWww = ![ "0", "false", "nein", "no" ].includes((r.include_www || r.www || "1").toLowerCase());

    try {
      if (db.prepare("SELECT id FROM domains WHERE domain = ?").get(domain)) {
        errors.push({ row: i + 2, domain, error: "exists" });
        continue;
      }
      insert.run(domain, targetUrl, groupId, [301,302,307,308].includes(code) ? code : 302, preserve ? 1 : 0, incWww ? 1 : 0, userId, now + i);
      imported++;
    } catch (e) {
      errors.push({ row: i + 2, domain, error: e instanceof Error ? e.message : String(e) });
    }
  }

  logAudit({ user_id: userId, user_email: session.user.email, action: "domain.import", target_type: "domain", target_id: String(imported), details: { imported, errors: errors.length } });
  return NextResponse.json({ imported, errors });
}
