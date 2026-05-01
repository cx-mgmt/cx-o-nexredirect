"use client";
import { useEffect, useState } from "react";
import { Loader2, RefreshCcw, ArrowUpCircle, Globe2, CheckCircle2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Settings = {
  base_domain: string | null;
  admin_email: string | null;
  update_auto: string | null;
  update_include_prereleases: string | null;
  hits_retention_days: string | null;
  webhook_url: string | null;
};

type UpdateStatus = {
  current: string;
  latest: string | null;
  update_available: boolean;
  release_url?: string;
  last_check?: number;
  auto_update: boolean;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [geo, setGeo] = useState<{ available: boolean; path: string } | null>(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [accountId, setAccountId] = useState("");
  const [installingGeo, setInstallingGeo] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const [s, u, g] = await Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/update/check").then((r) => r.json()),
      fetch("/api/settings/geo").then((r) => r.json()),
    ]);
    setSettings(s);
    setStatus(u);
    setGeo(g);
  }
  useEffect(() => { load(); }, []);

  async function installGeo() {
    if (!licenseKey.trim()) return;
    setInstallingGeo(true);
    setGeoMsg("");
    try {
      const r = await fetch("/api/settings/geo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: licenseKey.trim(),
          ...(accountId.trim() ? { account_id: accountId.trim() } : {}),
        }),
      });
      const d = await r.json();
      if (r.ok) {
        setGeoMsg("GeoLite2-DB installiert.");
        setLicenseKey("");
        setAccountId("");
        load();
      } else {
        const parts = [`Fehler: ${d.error || "Download fehlgeschlagen"}`];
        if (d.status) parts.push(`HTTP ${d.status}`);
        if (d.detail) parts.push(d.detail);
        if (d.hint) parts.push(`→ ${d.hint}`);
        setGeoMsg(parts.join(" — "));
      }
    } finally {
      setInstallingGeo(false);
    }
  }

  async function removeGeo() {
    if (!confirm("GeoIP-DB entfernen? Geo-Lookup wird deaktiviert.")) return;
    await fetch("/api/settings/geo", { method: "DELETE" });
    load();
  }

  async function save(patch: Partial<Settings>) {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSettings((s) => s ? { ...s, ...patch } : s);
    setSaving(false);
  }

  async function check() {
    setChecking(true);
    const r = await fetch("/api/update/check?force=1");
    setStatus(await r.json());
    setChecking(false);
  }

  async function waitForServerBack() {
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch("/api/v1/health", { cache: "no-store" });
        if (r.ok) return true;
      } catch {}
      await new Promise((res) => setTimeout(res, 1000));
    }
    return false;
  }

  async function applyNow() {
    if (!confirm(`Update auf ${status?.latest} jetzt installieren?\n\nDer Server wird neu gestartet (kurze Downtime der Admin-UI). Redirects bleiben über Caddy aktiv.`)) return;
    setApplying(true);
    setMsg("Update läuft — bitte warten...");

    // Fallback: reload after 90s no matter what (in case fetch/poll get stuck)
    const fallbackReload = setTimeout(() => window.location.reload(), 90_000);

    try {
      let d: { ok?: boolean; from?: string; to?: string; error?: string } = {};
      try {
        const r = await fetch("/api/update/apply", { method: "POST" });
        try { d = await r.json(); } catch {}
        if (!r.ok && !d.error) d.error = r.statusText;
      } catch (e) {
        // Connection drop = server probably restarted mid-response (legacy update.sh)
        d.error = e instanceof Error ? e.message : "connection_lost";
      }

      if (d.error === "no_update") {
        setMsg("Bereits auf aktueller Version.");
        clearTimeout(fallbackReload);
        await fetch("/api/update/check?force=1").catch(() => {});
        load();
        setApplying(false);
        return;
      }

      if (d.error && !d.to) {
        setMsg(`Fehler: ${d.error}`);
        clearTimeout(fallbackReload);
        setApplying(false);
        return;
      }

      setMsg(d.to ? `Update gezogen (${d.from} → ${d.to}). Server startet neu...` : "Server startet neu...");
      await new Promise((res) => setTimeout(res, 3000));
      const back = await waitForServerBack();
      setMsg(back ? "Server zurück. Lade Seite neu..." : "Restart dauert ungewöhnlich lang — lade trotzdem neu.");
      clearTimeout(fallbackReload);
      window.location.reload();
    } catch (e) {
      setMsg(`Fehler: ${e instanceof Error ? e.message : String(e)} — lade in 5s neu.`);
      setTimeout(() => window.location.reload(), 5000);
    }
  }

  if (!settings || !status || !geo) {
    return <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Einstellungen" description="Server-Konfiguration und Updates" />

      <div className="space-y-4 p-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Updates {status.update_available && <Badge variant="green">Verfügbar</Badge>}
            </CardTitle>
            <CardDescription>
              Aktuelle Version <span className="font-mono">{status.current}</span>
              {status.latest && <> • Neueste <span className="font-mono">{status.latest}</span></>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={check} variant="outline" size="sm" disabled={checking || applying}>
                {checking ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCcw className="mr-2 h-3 w-3" />}
                Jetzt prüfen
              </Button>
              {status.update_available && !applying && (
                <Button onClick={applyNow} size="sm" disabled={applying}>
                  <ArrowUpCircle className="mr-2 h-3 w-3" />
                  Update {status.latest} installieren
                </Button>
              )}
              {!status.update_available && !applying && (
                <span className="text-xs text-green-400">✓ Aktuelle Version</span>
              )}
              {status.release_url && <a href={status.release_url} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 hover:underline">Release-Notes →</a>}
            </div>
            {applying && (
              <div className="flex items-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{msg || "Update läuft..."}</span>
              </div>
            )}
            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={settings.update_auto === "true"} onChange={(e) => save({ update_auto: e.target.checked ? "true" : "false" })} disabled={saving} />
                Auto-Update aktivieren <span className="text-xs text-muted-foreground">(Updates automatisch beim Check installieren)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={settings.update_include_prereleases === "true"} onChange={(e) => save({ update_include_prereleases: e.target.checked ? "true" : "false" })} disabled={saving} />
                Pre-Releases einbeziehen
              </label>
            </div>
            {msg && !applying && <p className="text-xs text-muted-foreground">{msg}</p>}
            {status.last_check && <p className="text-xs text-muted-foreground">Letzte Prüfung: {new Date(status.last_check).toLocaleString("de-DE")}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Server</CardTitle>
            <CardDescription>Allgemeine Konfiguration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="baseDomain">Admin-Domain</Label>
              <Input
                id="baseDomain"
                placeholder="admin.beispiel.de"
                defaultValue={settings.base_domain ?? ""}
                onBlur={(e) => save({ base_domain: e.target.value.trim() })}
              />
              <p className="text-[11px] text-muted-foreground">Optional. Bestimmt unter welcher Domain die Admin-UI erreichbar ist.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminEmail">Admin-E-Mail (Let&apos;s Encrypt)</Label>
              <Input
                id="adminEmail"
                type="email"
                placeholder="admin@beispiel.de"
                defaultValue={settings.admin_email ?? ""}
                onBlur={(e) => save({ admin_email: e.target.value.trim() })}
              />
              <p className="text-[11px] text-muted-foreground">Wird von Caddy für ACME/Let&apos;s Encrypt benötigt.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="retention">Hit-Retention (Tage)</Label>
              <Input
                id="retention"
                type="number"
                min={0}
                placeholder="365"
                defaultValue={settings.hits_retention_days ?? "365"}
                onBlur={(e) => save({ hits_retention_days: e.target.value || "365" })}
              />
              <p className="text-[11px] text-muted-foreground">Hits älter als diese Anzahl Tage werden täglich gelöscht. 0 = nie löschen.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook">Webhook-URL</Label>
              <Input
                id="webhook"
                type="url"
                placeholder="https://hooks.example.com/..."
                defaultValue={settings.webhook_url ?? ""}
                onBlur={(e) => save({ webhook_url: e.target.value.trim() })}
              />
              <p className="text-[11px] text-muted-foreground">POST mit JSON bei Domain-Verify-Fail / Update-Available. Leer = aus.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="h-4 w-4" />
              GeoIP-Tracking
              {geo.available
                ? <Badge variant="green"><CheckCircle2 className="mr-1 h-3 w-3" />aktiv</Badge>
                : <Badge variant="zinc">deaktiviert</Badge>}
            </CardTitle>
            <CardDescription>
              MaxMind GeoLite2-Country für Land-Auflösung pro Hit. Lizenz-Key kostenlos unter <a href="https://www.maxmind.com/en/geolite2/signup" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">maxmind.com</a> generieren.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {geo.available ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">DB-Pfad: <span className="font-mono">{geo.path}</span></p>
                <Button onClick={removeGeo} variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-3 w-3" />Entfernen
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="accountId">MaxMind Account-ID</Label>
                  <Input
                    id="accountId"
                    type="text"
                    placeholder="123456"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    disabled={installingGeo}
                  />
                  <p className="text-[11px] text-muted-foreground">Empfohlen — neue License-Keys brauchen die Account-ID (Basic Auth).</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="licenseKey">MaxMind License-Key</Label>
                  <div className="flex gap-2">
                    <Input
                      id="licenseKey"
                      type="password"
                      placeholder="xxxxxxxxxxxxxxxx"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      disabled={installingGeo}
                    />
                    <Button onClick={installGeo} disabled={installingGeo || !licenseKey.trim()}>
                      {installingGeo ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                      Installieren
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Lädt GeoLite2-Country.mmdb herunter. EULA muss im MaxMind-Account akzeptiert sein.</p>
                </div>
              </div>
            )}
            {geoMsg && <p className="text-xs text-muted-foreground">{geoMsg}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
