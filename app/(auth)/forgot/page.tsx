"use client";
import { useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

export default function ForgotPage() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (d.error === "smtp_not_configured") setError("Server hat keinen Mail-Versand konfiguriert. Bitte Admin kontaktieren.");
        else if (d.error === "rate_limited") setError("Zu viele Versuche. Bitte später erneut.");
        else setError("Fehler. Versuche es später nochmal.");
        return;
      }
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4"><Logo size={48} /></div>
          <CardTitle className="text-2xl">Passwort vergessen</CardTitle>
          <CardDescription>Wir senden dir einen Link zum Zurücksetzen.</CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="space-y-4">
              <p className="rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">
                Falls ein Account zu deinen Angaben existiert, wurde eine Mail verschickt. Prüfe auch deinen Spam-Ordner.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login"><ArrowLeft className="mr-2 h-4 w-4" />Zurück zum Login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ident">E-Mail oder Benutzername</Label>
                <Input id="ident" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} disabled={loading} autoComplete="username" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading || !identifier.trim()}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sende...</> : "Reset-Link senden"}
              </Button>
              <Button asChild variant="ghost" size="sm" className="w-full">
                <Link href="/login">Zurück zum Login</Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
