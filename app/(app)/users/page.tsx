"use client";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Shield, User as UserIcon, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type U = { id: number; email: string; role: "admin" | "user"; created_at: number };

export default function UsersPage() {
  const [users, setUsers] = useState<U[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pwdOpen, setPwdOpen] = useState<U | null>(null);
  const [newPwd, setNewPwd] = useState("");

  async function load() {
    setLoading(true);
    const r = await fetch("/api/users");
    if (r.status === 403) { setForbidden(true); setLoading(false); return; }
    const d = await r.json();
    setUsers(d.users || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, role }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Fehler"); return; }
      setEmail(""); setPassword(""); setRole("user");
      setOpen(false);
      load();
    } finally { setBusy(false); }
  }

  async function changeRole(id: number, role: "admin" | "user") {
    const r = await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      alert(d.error || "Fehler");
    }
    load();
  }

  async function setPassword2(u: U, pwd: string) {
    const r = await fetch(`/api/users/${u.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pwd }) });
    if (!r.ok) { alert("Fehler"); return; }
    setPwdOpen(null);
    setNewPwd("");
  }

  async function del(u: U) {
    if (!confirm(`User "${u.email}" wirklich löschen?`)) return;
    const r = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "Fehler"); return; }
    load();
  }

  if (forbidden) {
    return (
      <div>
        <PageHeader title="Benutzer" description="Nur für Admins" />
        <div className="p-8">
          <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Keine Berechtigung. Nur Admin-Accounts können User verwalten.</CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Benutzer"
        description="Admin- und User-Accounts verwalten"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-3 w-3" />Neuer User</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neuer Benutzer</DialogTitle><DialogDescription>Account anlegen.</DialogDescription></DialogHeader>
              <form onSubmit={create} className="space-y-3">
                <div className="space-y-1"><Label>E-Mail</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-1"><Label>Passwort (min 8)</Label><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <div className="space-y-1">
                  <Label>Rolle</Label>
                  <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "user")} className="flex h-9 w-full rounded-md border border-input bg-zinc-950 px-3 text-sm text-zinc-100">
                    <option value="user" className="bg-zinc-900">User (read-only)</option>
                    <option value="admin" className="bg-zinc-900">Admin (alles)</option>
                  </select>
                </div>
                {err && <p className="text-xs text-destructive">{err}</p>}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
                  <Button type="submit" disabled={busy}>{busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}Anlegen</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-8">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-800/70 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 text-left">E-Mail</th>
                    <th className="px-6 py-3 text-left">Rolle</th>
                    <th className="px-6 py-3 text-left">Erstellt</th>
                    <th className="px-6 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-6 py-3">{u.email}</td>
                      <td className="px-6 py-3">
                        {u.role === "admin"
                          ? <Badge variant="green"><Shield className="mr-1 h-3 w-3" />admin</Badge>
                          : <Badge variant="zinc"><UserIcon className="mr-1 h-3 w-3" />user</Badge>}
                      </td>
                      <td className="px-6 py-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleString("de-DE")}</td>
                      <td className="px-6 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => changeRole(u.id, u.role === "admin" ? "user" : "admin")} className="rounded p-1.5 text-zinc-400 hover:text-zinc-100" title="Rolle wechseln">
                            <Shield className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setPwdOpen(u)} className="rounded p-1.5 text-zinc-400 hover:text-zinc-100" title="Passwort ändern">
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => del(u)} className="rounded p-1.5 text-zinc-400 hover:text-destructive" title="Löschen">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!pwdOpen} onOpenChange={(v) => { if (!v) { setPwdOpen(null); setNewPwd(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Passwort ändern</DialogTitle><DialogDescription>{pwdOpen?.email}</DialogDescription></DialogHeader>
          <div className="space-y-1"><Label>Neues Passwort (min 8)</Label><Input type="password" minLength={8} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPwdOpen(null); setNewPwd(""); }}>Abbrechen</Button>
            <Button onClick={() => pwdOpen && setPassword2(pwdOpen, newPwd)} disabled={newPwd.length < 8}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
