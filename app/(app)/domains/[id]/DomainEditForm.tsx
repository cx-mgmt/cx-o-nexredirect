"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Group = { id: number; name: string; target_url: string };

export function DomainEditForm({
  domainId,
  initial,
}: {
  domainId: number;
  initial: {
    target_url: string | null;
    group_id: number | null;
    redirect_code: number;
    preserve_path: number;
    include_www: number;
  };
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"url" | "group">(initial.group_id ? "group" : "url");
  const [targetUrl, setTargetUrl] = useState(initial.target_url ?? "");
  const [groupId, setGroupId] = useState<number | "">(initial.group_id ?? "");
  const [redirectCode, setRedirectCode] = useState<301 | 302>((initial.redirect_code as 301 | 302) || 302);
  const [preservePath, setPreservePath] = useState(!!initial.preserve_path);
  const [includeWww, setIncludeWww] = useState(!!initial.include_www);
  const [groups, setGroups] = useState<Group[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/groups").then((r) => r.json()).then((d) => setGroups(d.groups || [])).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setMsg("");
    const body: Record<string, unknown> = {
      redirect_code: redirectCode,
      preserve_path: preservePath,
      include_www: includeWww,
    };
    if (mode === "url") {
      body.target_url = targetUrl.trim();
      body.group_id = null;
    } else {
      body.group_id = groupId || null;
      body.target_url = null;
    }

    try {
      const r = await fetch(`/api/domains/${domainId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setMsg("Gespeichert.");
        router.refresh();
      } else {
        const d = await r.json().catch(() => ({}));
        setMsg(`Fehler: ${d.error || r.statusText}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Ziel</Label>
        <div className="flex gap-2">
          <Button type="button" variant={mode === "url" ? "default" : "outline"} size="sm" onClick={() => setMode("url")}>Einzel-URL</Button>
          <Button type="button" variant={mode === "group" ? "default" : "outline"} size="sm" onClick={() => setMode("group")} disabled={groups.length === 0}>Gruppe</Button>
        </div>
      </div>

      {mode === "url" ? (
        <div className="space-y-1">
          <Label htmlFor="target" className="text-xs">Ziel-URL</Label>
          <Input id="target" type="url" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://www.zielseite.de" />
        </div>
      ) : (
        <div className="space-y-1">
          <Label htmlFor="group" className="text-xs">Gruppe</Label>
          <select
            id="group"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : "")}
            className="flex h-9 w-full rounded-md border border-input bg-zinc-950 px-3 py-1 text-sm text-zinc-100"
          >
            <option value="" className="bg-zinc-900 text-zinc-100">— wählen —</option>
            {groups.map((g) => <option key={g.id} value={g.id} className="bg-zinc-900 text-zinc-100">{g.name} → {g.target_url}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Status-Code</Label>
          <select
            value={redirectCode}
            onChange={(e) => setRedirectCode(Number(e.target.value) as 301 | 302)}
            className="flex h-9 w-full rounded-md border border-input bg-zinc-950 px-3 py-1 text-sm text-zinc-100"
          >
            <option value={302} className="bg-zinc-900 text-zinc-100">302 (empfohlen)</option>
            <option value={301} className="bg-zinc-900 text-zinc-100">301 Permanent</option>
          </select>
        </div>
        <div className="flex flex-col justify-end gap-2 pb-1">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={preservePath} onChange={(e) => setPreservePath(e.target.checked)} />
            Pfad übernehmen
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={includeWww} onChange={(e) => setIncludeWww(e.target.checked)} />
            www.-Subdomain einbeziehen
          </label>
        </div>
      </div>

      {redirectCode === 301 && (
        <p className="text-[11px] text-amber-400">⚠ 301 wird vom Browser gecacht — Folge-Aufrufe werden nicht mehr gezählt.</p>
      )}

      <Button onClick={save} disabled={saving} size="sm" className="w-full">
        {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
        Speichern
      </Button>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
