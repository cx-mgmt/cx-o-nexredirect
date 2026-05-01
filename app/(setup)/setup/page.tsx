"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

export default function SetupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [baseDomain, setBaseDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((d) => {
        if (d.setup_complete) window.location.replace("/login");
        else setChecked(true);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== password2) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }
    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, baseDomain: baseDomain.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Setup fehlgeschlagen.");
        return;
      }
      window.location.href = "/login";
    } catch {
      setError("Verbindungsfehler.");
      setLoading(false);
    }
  }

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Logo size={48} />
          </div>
          <CardTitle className="text-2xl">Erstes Setup</CardTitle>
          <CardDescription>Erstelle deinen Admin-Account für NexRedirect</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Admin-E-Mail</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} placeholder="admin@beispiel.de" autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password2">Passwort wiederholen</Label>
              <Input id="password2" type="password" required value={password2} onChange={(e) => setPassword2(e.target.value)} disabled={loading} autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baseDomain">Admin-Domain <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="baseDomain" type="text" value={baseDomain} onChange={(e) => setBaseDomain(e.target.value)} disabled={loading} placeholder="admin.beispiel.de" />
              <p className="text-[11px] text-muted-foreground">Lass leer um die Server-IP zu verwenden.</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Erstelle...</> : <><ShieldCheck className="mr-2 h-4 w-4" />Account erstellen</>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
