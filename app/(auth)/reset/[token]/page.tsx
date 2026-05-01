"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { PasswordField } from "@/components/PasswordField";

export default function ResetPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [pwdValid, setPwdValid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/auth/reset?token=${encodeURIComponent(params.token)}`)
      .then((r) => r.json())
      .then((d) => setValid(!!d.valid))
      .finally(() => setValidating(false));
  }, [params.token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd !== pwd2) { setError("Passwörter stimmen nicht überein."); return; }
    if (!pwdValid) { setError("Passwort erfüllt die Anforderungen nicht."); return; }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: params.token, password: pwd }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.reason || d.error || "Fehler."); return; }
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4"><Logo size={48} /></div>
          <CardTitle className="text-2xl">Neues Passwort setzen</CardTitle>
          <CardDescription>{validating ? "Token prüfen…" : valid ? "Wähle ein neues Passwort." : "Token ungültig oder abgelaufen."}</CardDescription>
        </CardHeader>
        <CardContent>
          {validating ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !valid ? (
            <div className="space-y-3">
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                Der Reset-Link ist nicht (mehr) gültig. Fordere einen neuen an.
              </p>
              <Button asChild variant="outline" className="w-full"><Link href="/forgot">Neuen Link anfordern</Link></Button>
              <Button asChild variant="ghost" size="sm" className="w-full"><Link href="/login"><ArrowLeft className="mr-2 h-3 w-3" />Login</Link></Button>
            </div>
          ) : done ? (
            <div className="space-y-3">
              <p className="rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">Passwort gesetzt — leite zum Login weiter…</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <PasswordField value={pwd} onChange={setPwd} onValidationChange={(v) => setPwdValid(!!v.ok)} disabled={busy} />
              <div className="space-y-2">
                <Label htmlFor="pw2">Wiederholen</Label>
                <Input id="pw2" type="password" required value={pwd2} onChange={(e) => setPwd2(e.target.value)} disabled={busy} />
                {pwd2 && pwd !== pwd2 && <p className="text-[11px] text-amber-400">Passwörter stimmen nicht überein.</p>}
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy || !pwdValid || pwd !== pwd2}>
                {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setze…</> : "Passwort setzen"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
