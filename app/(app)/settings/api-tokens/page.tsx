"use client";
import { useEffect, useState } from "react";
import { Loader2, Plus, Copy, Trash2, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const SCOPES = ["read:domains", "write:domains", "read:analytics", "read:hits"] as const;

type Token = {
  id: number;
  name: string;
  scopes: string;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
};

export default function ApiTokensPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["read:domains", "read:analytics"]);
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/tokens");
    const d = await r.json();
    setTokens(d.tokens || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const r = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), scopes: selectedScopes }),
      });
      const d = await r.json();
      if (r.ok) {
        setNewToken(d.token);
        setName("");
        setSelectedScopes(["read:domains", "read:analytics"]);
        load();
      }
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: number) {
    if (!confirm("Token wirklich widerrufen?")) return;
    await fetch(`/api/tokens/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <PageHeader
        title="API-Tokens"
        description="Tokens für externe Monitoring-Tools und Integrationen"
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setNewToken(null); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-3 w-3" />Neuen Token</Button>
            </DialogTrigger>
            <DialogContent>
              {newToken ? (
                <div className="space-y-4">
                  <DialogHeader>
                    <DialogTitle>Token erstellt</DialogTitle>
                    <DialogDescription>Wird nur einmal angezeigt — sicher kopieren.</DialogDescription>
                  </DialogHeader>
                  <div className="rounded-md border bg-zinc-950 p-3">
                    <code className="block break-all font-mono text-xs">{newToken}</code>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => navigator.clipboard?.writeText(newToken)}>
                      <Copy className="mr-2 h-3 w-3" />Kopieren
                    </Button>
                    <Button onClick={() => { setOpen(false); setNewToken(null); }}>Fertig</Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={create} className="space-y-4">
                  <DialogHeader>
                    <DialogTitle>Neuen Token erstellen</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="tname">Name</Label>
                    <Input id="tname" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Uptime-Monitor" />
                  </div>
                  <div className="space-y-2">
                    <Label>Scopes</Label>
                    <div className="space-y-1">
                      {SCOPES.map((s) => (
                        <label key={s} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedScopes.includes(s)}
                            onChange={(e) => setSelectedScopes((cur) => e.target.checked ? [...cur, s] : cur.filter((x) => x !== s))}
                          />
                          <code className="font-mono text-xs">{s}</code>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={creating || selectedScopes.length === 0}>
                      {creating ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}Erstellen
                    </Button>
                  </div>
                </form>
              )}
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-8">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : tokens.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Keine Tokens.</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-800/70 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium">Name</th>
                    <th className="px-6 py-3 text-left font-medium">Scopes</th>
                    <th className="px-6 py-3 text-left font-medium">Erstellt</th>
                    <th className="px-6 py-3 text-left font-medium">Zuletzt benutzt</th>
                    <th className="px-6 py-3 text-left font-medium">Status</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {tokens.map((t) => {
                    const scopes = JSON.parse(t.scopes) as string[];
                    return (
                      <tr key={t.id} className="hover:bg-zinc-900/40">
                        <td className="px-6 py-3 font-medium"><KeyRound className="mr-2 inline h-3 w-3 text-cyan-400" />{t.name}</td>
                        <td className="px-6 py-3"><div className="flex flex-wrap gap-1">{scopes.map((s) => <Badge key={s} variant="zinc">{s}</Badge>)}</div></td>
                        <td className="px-6 py-3 text-muted-foreground">{new Date(t.created_at).toLocaleDateString("de-DE")}</td>
                        <td className="px-6 py-3 text-muted-foreground">{t.last_used_at ? new Date(t.last_used_at).toLocaleString("de-DE") : "—"}</td>
                        <td className="px-6 py-3">{t.revoked_at ? <Badge variant="destructive">widerrufen</Badge> : <Badge variant="green">aktiv</Badge>}</td>
                        <td className="px-6 py-3 text-right">
                          {!t.revoked_at && (
                            <button onClick={() => revoke(t.id)} className="rounded p-1 text-zinc-500 hover:text-destructive" title="Widerrufen">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
