"use client";
import { useEffect, useState } from "react";
import { Loader2, RefreshCcw, ArrowUpCircle } from "lucide-react";
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
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const [s, u] = await Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/update/check").then((r) => r.json()),
    ]);
    setSettings(s);
    setStatus(u);
  }
  useEffect(() => { load(); }, []);

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

  async function applyNow() {
    if (!confirm(`Update auf ${status?.latest} jetzt installieren?\n\nDer Server wird neu gestartet (kurze Downtime der Admin-UI). Redirects bleiben über Caddy aktiv.`)) return;
    setApplying(true);
    setMsg("");
    try {
      const r = await fetch("/api/update/apply", { method: "POST" });
      const d = await r.json();
      setMsg(d.ok ? `Update erfolgreich: ${d.from} → ${d.to}` : `Fehler: ${d.error}`);
      load();
    } finally {
      setApplying(false);
    }
  }

  if (!settings || !status) {
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
              <Button onClick={check} variant="outline" size="sm" disabled={checking}>
                {checking ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCcw className="mr-2 h-3 w-3" />}
                Jetzt prüfen
              </Button>
              {status.update_available && (
                <Button onClick={applyNow} size="sm" disabled={applying}>
                  {applying ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <ArrowUpCircle className="mr-2 h-3 w-3" />}
                  Update {status.latest} installieren
                </Button>
              )}
              {status.release_url && <a href={status.release_url} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 hover:underline">Release-Notes →</a>}
            </div>
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
            {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
