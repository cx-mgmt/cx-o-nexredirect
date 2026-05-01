"use client";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Pencil } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Group = { id: number; name: string; target_url: string; redirect_code: number; domain_count: number };

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [code, setCode] = useState<301 | 302>(302);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Group | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/groups");
    const d = await r.json();
    setGroups(d.groups || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), target_url: targetUrl.trim(), redirect_code: code }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Fehler");
        return;
      }
      setOpen(false);
      setName(""); setTargetUrl(""); setCode(301);
      load();
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Gruppe wirklich löschen?")) return;
    const res = await fetch(`/api/groups/${id}`, { method: "DELETE" });
    if (res.status === 409) {
      alert("Gruppe wird noch von Domains verwendet.");
      return;
    }
    load();
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setCreating(true);
    setError("");
    try {
      const r = await fetch(`/api/groups/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editing.name, target_url: editing.target_url, redirect_code: editing.redirect_code }),
      });
      if (!r.ok) {
        const d = await r.json();
        setError(d.error || "Fehler");
        return;
      }
      setEditing(null);
      load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Domain-Gruppen"
        description="Mehrere Domains zu einem Ziel zusammenfassen"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-3 w-3" />Neue Gruppe</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neue Gruppe</DialogTitle>
                <DialogDescription>Mehrere Domains können dasselbe Ziel teilen.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Marketing-Domains" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target">Ziel-URL</Label>
                  <Input id="target" required type="url" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://www.firma.de" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Status-Code</Label>
                  <select id="code" value={code} onChange={(e) => setCode(Number(e.target.value) as 301 | 302)} className="flex h-9 w-full rounded-md border border-input bg-zinc-950 px-3 py-1 text-sm text-zinc-100">
                    <option value={302} className="bg-zinc-900 text-zinc-100">302 Temporär (empfohlen)</option>
                    <option value={301} className="bg-zinc-900 text-zinc-100">301 Permanent</option>
                  </select>
                  {code === 301 && (
                    <p className="text-[11px] text-amber-400">⚠ 301 wird vom Browser gecacht — Hits gehen verloren.</p>
                  )}
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end">
                  <Button type="submit" disabled={creating}>
                    {creating ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Anlegen...</> : "Anlegen"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-8">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : groups.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Noch keine Gruppen angelegt.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <Card key={g.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{g.name}</CardTitle>
                    <div className="flex gap-1">
                      <button onClick={() => setEditing({ ...g })} className="rounded p-1 text-zinc-500 hover:text-zinc-200" title="Bearbeiten">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(g.id)} className="rounded p-1 text-zinc-500 hover:text-destructive" title="Löschen">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="truncate text-xs text-muted-foreground">{g.target_url}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="zinc">{g.redirect_code}</Badge>
                    <Badge variant="blue">{g.domain_count} Domain{g.domain_count === 1 ? "" : "s"}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gruppe bearbeiten</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Name</Label>
                <Input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Ziel-URL</Label>
                <Input required type="url" value={editing.target_url} onChange={(e) => setEditing({ ...editing, target_url: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Status-Code</Label>
                <select value={editing.redirect_code} onChange={(e) => setEditing({ ...editing, redirect_code: Number(e.target.value) })} className="flex h-9 w-full rounded-md border border-input bg-zinc-950 px-3 py-1 text-sm text-zinc-100">
                  <option value={302} className="bg-zinc-900 text-zinc-100">302 Temporär</option>
                  <option value={301} className="bg-zinc-900 text-zinc-100">301 Permanent</option>
                </select>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Abbrechen</Button>
                <Button type="submit" disabled={creating}>
                  {creating ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}Speichern
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
