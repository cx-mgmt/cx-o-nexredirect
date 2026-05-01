"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, AlertCircle, ArrowRight, Loader2, Sunset, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type DomainListRow = {
  id: number;
  domain: string;
  status: "pending" | "active" | "error";
  target_url: string | null;
  group_id: number | null;
  group_name: string | null;
  group_target: string | null;
  total_hits: number;
  last_hit: number | null;
  sunset_config: string | null;
};

function timeAgo(ts: number | null): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "gerade eben";
  if (m < 60) return `vor ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} h`;
  const d = Math.floor(h / 24);
  return `vor ${d} d`;
}

export function DomainsListClient({ domains }: { domains: DomainListRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [title, setTitle] = useState("Diese Domain wird abgeschaltet");
  const [message, setMessage] = useState("");
  const [buttonLabel, setButtonLabel] = useState("Weiter");
  const [sunsetDate, setSunsetDate] = useState("");
  const [saving, setSaving] = useState(false);

  function toggle(id: number) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (selected.size === domains.length) setSelected(new Set());
    else setSelected(new Set(domains.map((d) => d.id)));
  }

  async function applyBulk() {
    setSaving(true);
    try {
      const cfg = enabled
        ? { enabled: true, title, message, button_label: buttonLabel, sunset_date: sunsetDate || undefined }
        : null;
      const r = await fetch("/api/domains/sunset-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain_ids: Array.from(selected), config: cfg }),
      });
      if (r.ok) {
        setBulkOpen(false);
        setSelected(new Set());
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function bulkDelete() {
    const ids = Array.from(selected);
    const totalHits = domains.filter((d) => selected.has(d.id)).reduce((s, d) => s + d.total_hits, 0);
    const msg = `${ids.length} Domain${ids.length === 1 ? "" : "s"} unwiderruflich löschen?\n\n${totalHits.toLocaleString("de-DE")} Hits werden mitgelöscht.`;
    if (!confirm(msg)) return;
    setSaving(true);
    try {
      const r = await fetch("/api/domains/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain_ids: ids }),
      });
      if (r.ok) {
        setSelected(new Set());
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 space-y-3">
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-md border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm">
          <span>{selected.size} ausgewählt</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>Auswahl aufheben</Button>
            <Button size="sm" variant="destructive" onClick={bulkDelete} disabled={saving}>
              <Trash2 className="mr-1 h-3 w-3" />
              Löschen
            </Button>
            <Button size="sm" onClick={() => setBulkOpen(true)}>
              <Sunset className="mr-1 h-3 w-3" />
              Sunset-Hinweis
            </Button>
          </div>
        </div>
      )}

      {domains.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-muted-foreground">Noch keine Domain angelegt.</p>
            <Button asChild>
              <Link href="/domains/new">Erste Domain hinzufügen</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800/70 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 text-left">
                    <input type="checkbox" checked={selected.size === domains.length && domains.length > 0} onChange={toggleAll} />
                  </th>
                  <th className="px-3 py-3 text-left font-medium">Domain</th>
                  <th className="px-3 py-3 text-left font-medium">Status</th>
                  <th className="px-3 py-3 text-left font-medium">Ziel</th>
                  <th className="px-3 py-3 text-right font-medium">Hits</th>
                  <th className="px-3 py-3 text-left font-medium">Letzter Hit</th>
                  <th className="px-3 py-3 text-left font-medium">Sunset</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {domains.map((d) => {
                  const sunsetEnabled = (() => {
                    try { return d.sunset_config ? JSON.parse(d.sunset_config).enabled === true : false; } catch { return false; }
                  })();
                  return (
                    <tr key={d.id} className="hover:bg-zinc-900/40">
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} />
                      </td>
                      <td className="px-3 py-3 font-medium text-zinc-100">{d.domain}</td>
                      <td className="px-3 py-3">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        <span className="truncate">{d.target_url || d.group_target || "—"}</span>
                        {d.group_name && <span className="ml-2 text-xs text-cyan-400">({d.group_name})</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{d.total_hits.toLocaleString("de-DE")}</td>
                      <td className="px-3 py-3 text-muted-foreground">{timeAgo(d.last_hit)}</td>
                      <td className="px-3 py-3">
                        {sunsetEnabled ? <Badge variant="amber">aktiv</Badge> : <span className="text-xs text-zinc-600">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/domains/${d.id}`}>
                            Details <ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sunset-Hinweis für {selected.size} Domain{selected.size === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>Setzt eine Hinweisseite vor dem Redirect. Nutzer klickt sich aktiv durch.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Aktivieren (uncheck = deaktivieren / entfernen)
            </label>
            {enabled && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Titel</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nachricht</Label>
                  <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Button-Text</Label>
                    <Input value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Abschaltdatum</Label>
                    <Input value={sunsetDate} onChange={(e) => setSunsetDate(e.target.value)} placeholder="31.12.2026" />
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Abbrechen</Button>
            <Button onClick={applyBulk} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
              Auf {selected.size} anwenden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: "pending" | "active" | "error" }) {
  if (status === "active") return <Badge variant="green"><CheckCircle2 className="mr-1 h-3 w-3" />aktiv</Badge>;
  if (status === "pending") return <Badge variant="amber"><Clock className="mr-1 h-3 w-3" />wartet</Badge>;
  return <Badge variant="destructive"><AlertCircle className="mr-1 h-3 w-3" />fehler</Badge>;
}
