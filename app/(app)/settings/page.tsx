"use client";
import { useEffect, useState } from "react";
import { Loader2, RefreshCcw, ArrowUpCircle, Globe2, CheckCircle2, Trash2, Mail, Send, Pencil, Server, Bell, ShieldCheck, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Settings = {
  base_domain: string | null;
  admin_email: string | null;
  update_auto: string | null;
  update_include_prereleases: string | null;
  hits_retention_days: string | null;
  webhook_url: string | null;
};

type IpAllowlist = { allowlist: string[]; my_ip: string };

type UpdateStatus = {
  current: string;
  latest: string | null;
  update_available: boolean;
  release_url?: string;
  last_check?: number;
  auto_update: boolean;
};

type Smtp = {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_password: string;
  smtp_from: string;
  smtp_secure: string;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [geo, setGeo] = useState<{ available: boolean; path: string } | null>(null);
  const [smtp, setSmtp] = useState<Smtp | null>(null);
  const [ipAllowlist, setIpAllowlist] = useState<IpAllowlist | null>(null);

  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [updateMsg, setUpdateMsg] = useState("");

  const [serverOpen, setServerOpen] = useState(false);
  const [smtpOpen, setSmtpOpen] = useState(false);
  const [geoOpen, setGeoOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [ipOpen, setIpOpen] = useState(false);

  async function load() {
    const [s, u, g, m, ip] = await Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/update/check").then((r) => r.json()),
      fetch("/api/settings/geo").then((r) => r.json()),
      fetch("/api/settings/smtp").then((r) => r.json()),
      fetch("/api/settings/ip-allowlist").then((r) => r.json()),
    ]);
    setSettings(s);
    setStatus(u);
    setGeo(g);
    setSmtp({
      smtp_host: m.smtp_host || "",
      smtp_port: m.smtp_port || "587",
      smtp_user: m.smtp_user || "",
      smtp_password: m.smtp_password || "",
      smtp_from: m.smtp_from || "",
      smtp_secure: m.smtp_secure || "false",
    });
    setIpAllowlist(ip as IpAllowlist);
  }
  useEffect(() => { load(); }, []);

  async function saveSettings(patch: Partial<Settings>) {
    await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    load();
  }

  async function check() {
    setChecking(true);
    const r = await fetch("/api/update/check?force=1");
    setStatus(await r.json());
    setChecking(false);
  }

  async function waitForServerBack() {
    for (let i = 0; i < 60; i++) {
      try { const r = await fetch("/api/v1/health", { cache: "no-store" }); if (r.ok) return true; } catch {}
      await new Promise((res) => setTimeout(res, 1000));
    }
    return false;
  }

  async function applyNow() {
    if (!confirm(`Update auf ${status?.latest} jetzt installieren?\n\nServer wird neu gestartet (kurze Downtime). Redirects bleiben über Caddy aktiv.`)) return;
    setApplying(true);
    setUpdateMsg("Update läuft — bitte warten...");
    const fallbackReload = setTimeout(() => window.location.reload(), 90_000);
    try {
      let d: { ok?: boolean; from?: string; to?: string; error?: string } = {};
      try {
        const r = await fetch("/api/update/apply", { method: "POST" });
        try { d = await r.json(); } catch {}
        if (!r.ok && !d.error) d.error = r.statusText;
      } catch (e) { d.error = e instanceof Error ? e.message : "connection_lost"; }

      if (d.error === "no_update") { setUpdateMsg("Bereits aktuell."); clearTimeout(fallbackReload); load(); setApplying(false); return; }
      if (d.error && !d.to) { setUpdateMsg(`Fehler: ${d.error}`); clearTimeout(fallbackReload); setApplying(false); return; }

      setUpdateMsg(d.to ? `Update gezogen (${d.from} → ${d.to}). Server startet neu...` : "Server startet neu...");
      await new Promise((res) => setTimeout(res, 3000));
      await waitForServerBack();
      clearTimeout(fallbackReload);
      window.location.reload();
    } catch (e) {
      setUpdateMsg(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
      setTimeout(() => window.location.reload(), 5000);
    }
  }

  if (!settings || !status || !geo || !smtp || !ipAllowlist) {
    return <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Einstellungen" description="Server-Konfiguration, Updates, Mail, Geo, Benachrichtigungen" />

      <div className="grid grid-cols-1 gap-4 p-8 lg:grid-cols-2">
        {/* Updates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4" />
              Updates
              {status.update_available && <Badge variant="green">Verfügbar</Badge>}
              {!status.update_available && <Badge variant="zinc">Aktuell</Badge>}
            </CardTitle>
            <CardDescription>
              Aktuell <span className="font-mono">{status.current}</span>
              {status.latest && <> • Neueste <span className="font-mono">{status.latest}</span></>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button onClick={check} variant="outline" size="sm" disabled={checking || applying}>
                {checking ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCcw className="mr-2 h-3 w-3" />}
                Prüfen
              </Button>
              {status.update_available && !applying && (
                <Button onClick={applyNow} size="sm">
                  <ArrowUpCircle className="mr-2 h-3 w-3" />
                  v{status.latest} installieren
                </Button>
              )}
              {status.release_url && <a href={status.release_url} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 hover:underline self-center">Notes →</a>}
            </div>
            {applying && (
              <div className="flex items-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
                <Loader2 className="h-3 w-3 animate-spin" /><span>{updateMsg}</span>
              </div>
            )}
            <div className="space-y-1 pt-1">
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={settings.update_auto === "true"} onChange={(e) => saveSettings({ update_auto: e.target.checked ? "true" : "false" })} />
                Auto-Update
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={settings.update_include_prereleases === "true"} onChange={(e) => saveSettings({ update_include_prereleases: e.target.checked ? "true" : "false" })} />
                Pre-Releases
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Server */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Server className="h-4 w-4" />Server</CardTitle>
            <CardDescription>Admin-Domain & ACME-Email</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="Admin-Domain">{settings.base_domain ? <span className="font-mono">{settings.base_domain}</span> : <em className="text-muted-foreground">— Server-IP —</em>}</Row>
            <Row k="Admin-E-Mail">{settings.admin_email || <em className="text-muted-foreground">—</em>}</Row>
            <Button onClick={() => setServerOpen(true)} variant="outline" size="sm" className="w-full">
              <Pencil className="mr-2 h-3 w-3" />Bearbeiten
            </Button>
          </CardContent>
        </Card>

        {/* SMTP */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />SMTP
              {smtp.smtp_host
                ? <Badge variant="green"><CheckCircle2 className="mr-1 h-3 w-3" />konfiguriert</Badge>
                : <Badge variant="zinc">aus</Badge>}
            </CardTitle>
            <CardDescription>Mail-Versand für Passwort-Reset</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {smtp.smtp_host ? (
              <>
                <Row k="Host"><span className="font-mono text-xs">{smtp.smtp_host}:{smtp.smtp_port}</span></Row>
                <Row k="Absender"><span className="font-mono text-xs">{smtp.smtp_from || smtp.smtp_user || "—"}</span></Row>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Ohne SMTP funktioniert "Passwort vergessen" nicht.</p>
            )}
            <Button onClick={() => setSmtpOpen(true)} variant="outline" size="sm" className="w-full">
              <Pencil className="mr-2 h-3 w-3" />{smtp.smtp_host ? "Bearbeiten" : "Konfigurieren"}
            </Button>
          </CardContent>
        </Card>

        {/* GeoIP */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="h-4 w-4" />GeoIP
              {geo.available
                ? <Badge variant="green"><CheckCircle2 className="mr-1 h-3 w-3" />aktiv</Badge>
                : <Badge variant="zinc">aus</Badge>}
            </CardTitle>
            <CardDescription>Land-Auflösung pro Hit (MaxMind GeoLite2)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {geo.available ? (
              <Row k="DB"><span className="font-mono text-[10px]">{geo.path.split("/").pop()}</span></Row>
            ) : (
              <p className="text-xs text-muted-foreground">Hit-Country bleibt leer ohne GeoIP-DB.</p>
            )}
            <Button onClick={() => setGeoOpen(true)} variant="outline" size="sm" className="w-full">
              <Pencil className="mr-2 h-3 w-3" />{geo.available ? "Verwalten" : "Aktivieren"}
            </Button>
          </CardContent>
        </Card>

        {/* IP-Allowlist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />IP-Zugriffsbeschränkung
              {ipAllowlist.allowlist.length > 0
                ? <Badge variant="green"><CheckCircle2 className="mr-1 h-3 w-3" />{ipAllowlist.allowlist.length} Einträge</Badge>
                : <Badge variant="zinc">offen</Badge>}
            </CardTitle>
            <CardDescription>Admin-UI nur für bestimmte IPs / CIDR-Bereiche</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="Deine IP"><span className="font-mono text-xs">{ipAllowlist.my_ip}</span></Row>
            {ipAllowlist.allowlist.length > 0 ? (
              <Row k="Freigegeben">
                <span className="font-mono text-xs text-right">{ipAllowlist.allowlist.slice(0, 2).join(", ")}{ipAllowlist.allowlist.length > 2 ? ` +${ipAllowlist.allowlist.length - 2}` : ""}</span>
              </Row>
            ) : (
              <p className="text-xs text-muted-foreground">Kein Filter — alle IPs haben Zugriff.</p>
            )}
            <Button onClick={() => setIpOpen(true)} variant="outline" size="sm" className="w-full">
              <Pencil className="mr-2 h-3 w-3" />Bearbeiten
            </Button>
          </CardContent>
        </Card>

        {/* Benachrichtigungen / Retention */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" />Benachrichtigungen & Datenhaltung</CardTitle>
            <CardDescription>Webhook-URL und Hit-Retention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="Hit-Retention">{settings.hits_retention_days || "365"} Tage</Row>
            <Row k="Webhook-URL">{settings.webhook_url ? <span className="font-mono text-xs">{settings.webhook_url}</span> : <em className="text-muted-foreground">—</em>}</Row>
            <Button onClick={() => setNotifyOpen(true)} variant="outline" size="sm">
              <Pencil className="mr-2 h-3 w-3" />Bearbeiten
            </Button>
          </CardContent>
        </Card>
      </div>

      <ServerDialog open={serverOpen} onClose={() => setServerOpen(false)} settings={settings} onSave={saveSettings} />
      <SmtpDialog open={smtpOpen} onClose={() => setSmtpOpen(false)} initial={smtp} onSaved={load} />
      <GeoDialog open={geoOpen} onClose={() => setGeoOpen(false)} status={geo} onChanged={load} />
      <NotifyDialog open={notifyOpen} onClose={() => setNotifyOpen(false)} settings={settings} onSave={saveSettings} />
      <IpAllowlistDialog open={ipOpen} onClose={() => setIpOpen(false)} initial={ipAllowlist} onSaved={load} />
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-800/40 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function ServerDialog({ open, onClose, settings, onSave }: { open: boolean; onClose: () => void; settings: Settings; onSave: (p: Partial<Settings>) => Promise<void> }) {
  const [base, setBase] = useState(settings.base_domain ?? "");
  const [email, setEmail] = useState(settings.admin_email ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setBase(settings.base_domain ?? ""); setEmail(settings.admin_email ?? ""); } }, [open, settings]);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Server</DialogTitle><DialogDescription>Admin-Domain für die UI und ACME-Email für Let&apos;s Encrypt.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Admin-Domain</Label><Input value={base} onChange={(e) => setBase(e.target.value)} placeholder="admin.beispiel.de" /></div>
          <div className="space-y-1"><Label>Admin-E-Mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@beispiel.de" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Abbrechen</Button>
          <Button onClick={async () => { setBusy(true); await onSave({ base_domain: base.trim(), admin_email: email.trim() }); setBusy(false); onClose(); }} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SmtpDialog({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial: Smtp; onSaved: () => void }) {
  const [s, setS] = useState<Smtp>(initial);
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  useEffect(() => { if (open) { setS(initial); setTestMsg(""); } }, [open, initial]);

  async function save() {
    setBusy(true);
    try {
      await fetch("/api/settings/smtp", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
      onSaved();
      onClose();
    } finally { setBusy(false); }
  }

  async function test() {
    setTestBusy(true); setTestMsg("");
    try {
      // Save first, then test
      await fetch("/api/settings/smtp", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
      const r = await fetch("/api/settings/smtp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: testTo || undefined }) });
      const d = await r.json();
      setTestMsg(d.ok ? "✓ Test-Mail verschickt." : `Fehler: ${d.error}`);
    } finally { setTestBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>SMTP konfigurieren</DialogTitle><DialogDescription>Mail-Server für Passwort-Reset und Benachrichtigungen.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1"><Label className="text-xs">Host</Label><Input value={s.smtp_host} onChange={(e) => setS({ ...s, smtp_host: e.target.value })} placeholder="smtp.example.com" /></div>
            <div className="space-y-1"><Label className="text-xs">Port</Label><Input type="number" value={s.smtp_port} onChange={(e) => setS({ ...s, smtp_port: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">Username</Label><Input value={s.smtp_user} onChange={(e) => setS({ ...s, smtp_user: e.target.value })} autoComplete="off" /></div>
            <div className="space-y-1"><Label className="text-xs">Passwort</Label><Input type="password" value={s.smtp_password} onChange={(e) => setS({ ...s, smtp_password: e.target.value })} autoComplete="new-password" placeholder={s.smtp_password === "***" ? "(unverändert)" : ""} /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">From-Adresse</Label><Input value={s.smtp_from} onChange={(e) => setS({ ...s, smtp_from: e.target.value })} placeholder='"NexRedirect" <noreply@example.com>' /></div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={s.smtp_secure === "true"} onChange={(e) => setS({ ...s, smtp_secure: e.target.checked ? "true" : "false" })} />
            TLS direkt (Port 465). Sonst STARTTLS.
          </label>
          <div className="rounded-md border bg-zinc-900/40 p-3 space-y-2">
            <p className="text-[11px] text-muted-foreground">Test-Mail an:</p>
            <div className="flex gap-2">
              <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="(leer = eigene Email)" />
              <Button onClick={test} variant="outline" size="sm" disabled={testBusy || !s.smtp_host}>
                {testBusy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />}Test
              </Button>
            </div>
            {testMsg && <p className="text-xs">{testMsg}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Schließen</Button>
          <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GeoDialog({ open, onClose, status, onChanged }: { open: boolean; onClose: () => void; status: { available: boolean; path: string }; onChanged: () => void }) {
  const [accountId, setAccountId] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function install() {
    if (!licenseKey.trim()) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/settings/geo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ license_key: licenseKey.trim(), ...(accountId.trim() ? { account_id: accountId.trim() } : {}) }) });
      const d = await r.json();
      if (r.ok) { setMsg("✓ DB installiert."); setLicenseKey(""); setAccountId(""); onChanged(); setTimeout(onClose, 800); }
      else {
        const parts = [`Fehler: ${d.error}`];
        if (d.status) parts.push(`HTTP ${d.status}`);
        if (d.hint) parts.push(`→ ${d.hint}`);
        setMsg(parts.join(" — "));
      }
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!confirm("GeoIP-DB entfernen? Geo-Lookup wird deaktiviert.")) return;
    await fetch("/api/settings/geo", { method: "DELETE" });
    onChanged();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>GeoIP-Tracking</DialogTitle>
          <DialogDescription>MaxMind GeoLite2-Country. Lizenz-Key kostenlos auf <a href="https://www.maxmind.com/en/geolite2/signup" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">maxmind.com</a>.</DialogDescription>
        </DialogHeader>
        {status.available ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">DB installiert: <span className="font-mono">{status.path}</span></p>
            <Button onClick={remove} variant="destructive" size="sm" className="w-full">
              <Trash2 className="mr-2 h-3 w-3" />Entfernen
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">MaxMind Account-ID</Label><Input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="123456" /></div>
            <div className="space-y-1"><Label className="text-xs">License-Key</Label><Input type="password" value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)} /></div>
            {msg && <p className="text-xs">{msg}</p>}
            <Button onClick={install} disabled={busy || !licenseKey.trim()} className="w-full">
              {busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}Installieren
            </Button>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Schließen</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IpAllowlistDialog({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial: IpAllowlist; onSaved: () => void }) {
  const [text, setText] = useState(initial.allowlist.join("\n"));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { if (open) { setText(initial.allowlist.join("\n")); setMsg(""); } }, [open, initial]);

  const parsed = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const myIpIncluded = parsed.length === 0 || parsed.some((e) => e === initial.my_ip || initial.my_ip.startsWith(e.split("/")[0]));

  async function save() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/settings/ip-allowlist", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allowlist: parsed }) });
      const d = await r.json();
      if (!r.ok) { setMsg(`Fehler: ${d.error}`); return; }
      onSaved();
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>IP-Zugriffsbeschränkung</DialogTitle>
          <DialogDescription>Eine IP oder CIDR pro Zeile. Leer = alle IPs erlaubt. Gilt für die gesamte Admin-UI (außer <code>/api/v1</code>).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-zinc-700/50 bg-zinc-900/40 px-3 py-2 text-xs flex items-center gap-2">
            <span className="text-muted-foreground">Deine IP:</span>
            <code className="font-mono">{initial.my_ip}</code>
          </div>
          {!myIpIncluded && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>Deine IP ist nicht in der Liste — du sperrst dich selbst aus!</span>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">IPs / CIDR-Bereiche (eine pro Zeile)</Label>
            <textarea
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"192.168.1.0/24\n10.0.0.1\n2001:db8::1"}
            />
            <p className="text-[11px] text-muted-foreground">{parsed.length === 0 ? "Kein Filter — alle IPs haben Zugriff." : `${parsed.length} Eintrag/Einträge aktiv.`}</p>
          </div>
          {msg && <p className="text-xs text-red-400">{msg}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Abbrechen</Button>
          <Button onClick={save} disabled={busy} variant={!myIpIncluded && parsed.length > 0 ? "destructive" : "default"}>
            {busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
            {!myIpIncluded && parsed.length > 0 ? "Trotzdem speichern" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NotifyDialog({ open, onClose, settings, onSave }: { open: boolean; onClose: () => void; settings: Settings; onSave: (p: Partial<Settings>) => Promise<void> }) {
  const [retention, setRetention] = useState(settings.hits_retention_days ?? "365");
  const [webhook, setWebhook] = useState(settings.webhook_url ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setRetention(settings.hits_retention_days ?? "365"); setWebhook(settings.webhook_url ?? ""); } }, [open, settings]);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Benachrichtigungen & Retention</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Hit-Retention (Tage)</Label>
            <Input type="number" min={0} value={retention} onChange={(e) => setRetention(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Hits älter als diese Anzahl Tage werden täglich gelöscht. 0 = nie.</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Webhook-URL</Label>
            <Input type="url" value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://hooks.example.com/..." />
            <p className="text-[11px] text-muted-foreground">POST mit JSON bei Domain-Verify-Fail. Leer = aus.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Abbrechen</Button>
          <Button onClick={async () => { setBusy(true); await onSave({ hits_retention_days: retention || "365", webhook_url: webhook.trim() }); setBusy(false); onClose(); }} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
