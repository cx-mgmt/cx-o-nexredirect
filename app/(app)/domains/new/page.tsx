"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Copy, Check, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { copyToClipboard } from "@/lib/clipboard";

type Group = { id: number; name: string; target_url: string };

type VerifyResult = {
  ok: boolean;
  result: {
    expected: { ipv4?: string; ipv6?: string };
    resolved: { a: string[]; aaaa: string[]; wwwA: string[]; wwwAaaa: string[] };
    missing: string[];
  };
};

export default function NewDomainPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [domainId, setDomainId] = useState<number | null>(null);

  // Step 1 form
  const [domain, setDomain] = useState("");
  const [targetMode, setTargetMode] = useState<"url" | "group">("url");
  const [targetUrl, setTargetUrl] = useState("");
  const [groupId, setGroupId] = useState<number | "">("");
  const [redirectCode, setRedirectCode] = useState<301 | 302>(302);
  const [preservePath, setPreservePath] = useState(true);
  const [includeWww, setIncludeWww] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Step 2/3
  const [serverIps, setServerIps] = useState<{ ipv4?: string; ipv6?: string }>({});
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    fetch("/api/groups").then((r) => r.json()).then((d) => setGroups(d.groups || [])).catch(() => {});
    fetch("/api/settings/server-ip").then((r) => r.json()).then(setServerIps).catch(() => {});
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        domain: domain.trim().toLowerCase(),
        redirect_code: redirectCode,
        preserve_path: preservePath,
        include_www: includeWww,
      };
      if (targetMode === "url") body.target_url = targetUrl.trim();
      else body.group_id = groupId;

      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Fehler beim Anlegen");
        return;
      }
      setDomainId(d.domain.id);
      setStep(2);
    } finally {
      setCreating(false);
    }
  }

  async function handleVerify() {
    if (!domainId) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch(`/api/domains/${domainId}/verify`, { method: "POST" });
      const d = await res.json();
      setVerifyResult(d);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div>
      <PageHeader title="Domain hinzufügen" description={`Schritt ${step} von 3`} />

      <div className="mx-auto max-w-2xl space-y-4 p-8">
        <StepIndicator step={step} />

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Domain & Ziel</CardTitle>
              <CardDescription>Lege fest, welche Domain wohin weiterleiten soll.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain</Label>
                  <Input id="domain" required placeholder="beispiel.de" value={domain} onChange={(e) => setDomain(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Ziel</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant={targetMode === "url" ? "default" : "outline"} size="sm" onClick={() => setTargetMode("url")}>Einzel-URL</Button>
                    <Button type="button" variant={targetMode === "group" ? "default" : "outline"} size="sm" onClick={() => setTargetMode("group")} disabled={groups.length === 0}>Gruppe</Button>
                  </div>
                </div>

                {targetMode === "url" ? (
                  <div className="space-y-2">
                    <Label htmlFor="target">Ziel-URL</Label>
                    <Input id="target" required type="url" placeholder="https://www.zielseite.de" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="group">Gruppe</Label>
                    <select
                      id="group"
                      required
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : "")}
                      className="flex h-9 w-full rounded-md border border-input bg-zinc-950 px-3 py-1 text-sm text-zinc-100 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="" className="bg-zinc-900 text-zinc-100">— wählen —</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id} className="bg-zinc-900 text-zinc-100">{g.name} → {g.target_url}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Status-Code</Label>
                    <select
                      id="code"
                      value={redirectCode}
                      onChange={(e) => setRedirectCode(Number(e.target.value) as 301 | 302)}
                      className="flex h-9 w-full rounded-md border border-input bg-zinc-950 px-3 py-1 text-sm text-zinc-100"
                    >
                      <option value={302} className="bg-zinc-900 text-zinc-100">302 Temporär (empfohlen)</option>
                      <option value={301} className="bg-zinc-900 text-zinc-100">301 Permanent</option>
                    </select>
                    {redirectCode === 301 && (
                      <p className="text-[11px] text-amber-400">
                        ⚠ 301 wird vom Browser gecacht — Folge-Aufrufe gehen direkt zum Ziel ohne hier gezählt zu werden.
                      </p>
                    )}
                  </div>
                  <div className="flex items-end gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={preservePath} onChange={(e) => setPreservePath(e.target.checked)} />
                      Pfad übernehmen
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={includeWww} onChange={(e) => setIncludeWww(e.target.checked)} />
                      www.
                    </label>
                  </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={creating}>
                    {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Lege an...</> : <>Weiter <ArrowRight className="ml-2 h-4 w-4" /></>}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>DNS-Records eintragen</CardTitle>
              <CardDescription>Trage diese Records bei deinem DNS-Provider ein:</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DnsRecordsTable domain={domain.trim().toLowerCase()} ipv4={serverIps.ipv4} ipv6={serverIps.ipv6} includeWww={includeWww} />
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                Hinweis: DNS-Änderungen können einige Minuten bis zur Sichtbarkeit dauern.
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setStep(3)}>Weiter <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Validierung</CardTitle>
              <CardDescription>Prüft, ob die DNS-Records korrekt gesetzt sind.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleVerify} disabled={verifying} className="w-full">
                {verifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Prüfe...</> : "Jetzt prüfen"}
              </Button>

              {verifyResult && (
                <div className="space-y-3">
                  {verifyResult.ok ? (
                    <div className="rounded-md border border-green-500/30 bg-green-500/10 p-4">
                      <div className="flex items-center gap-2 text-green-300">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-semibold">DNS korrekt — Domain ist aktiv!</span>
                      </div>
                      <p className="mt-1 text-xs text-green-200/80">Caddy wurde neu geladen. Aufrufe werden jetzt weitergeleitet.</p>
                      <Button className="mt-3" size="sm" onClick={() => router.push(`/domains/${domainId}`)}>Zur Domain</Button>
                    </div>
                  ) : (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4">
                      <div className="flex items-center gap-2 text-amber-300">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="font-semibold">DNS-Records noch nicht korrekt</span>
                      </div>
                      <p className="mt-2 text-xs text-amber-200/80">Fehlend:</p>
                      <ul className="ml-4 mt-1 list-disc text-xs text-amber-100/90">
                        {verifyResult.result.missing.map((m, i) => <li key={i}>{m}</li>)}
                      </ul>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-muted-foreground">Aufgelöst (A):</p>
                          <p className="font-mono">{verifyResult.result.resolved.a.join(", ") || "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Erwartet:</p>
                          <p className="font-mono">{verifyResult.result.expected.ipv4 || "(server-IP)"}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {[1, 2, 3].map((n) => (
        <Badge key={n} variant={n === step ? "default" : n < step ? "green" : "zinc"}>
          {n < step ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}
          Schritt {n}
        </Badge>
      ))}
    </div>
  );
}

function DnsRecordsTable({ domain, ipv4, ipv6, includeWww }: { domain: string; ipv4?: string; ipv6?: string; includeWww: boolean }) {
  const records = [
    { type: "A", name: "@", note: `(Root: ${domain})`, value: ipv4 || "<server-IP>" },
    ...(ipv6 ? [{ type: "AAAA", name: "@", note: `(Root: ${domain})`, value: ipv6 }] : []),
    ...(includeWww ? [{ type: "A", name: "www", note: `(www.${domain})`, value: ipv4 || "<server-IP>" }] : []),
  ];

  const [copied, setCopied] = useState<number | null>(null);
  async function copy(idx: number, val: string) {
    const ok = await copyToClipboard(val);
    if (ok) {
      setCopied(idx);
      setTimeout(() => setCopied(null), 1500);
    } else {
      alert("Kopieren fehlgeschlagen — bitte manuell markieren und kopieren.");
    }
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-zinc-900/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Typ</th>
              <th className="px-4 py-2 text-left font-medium">Name</th>
              <th className="px-4 py-2 text-left font-medium">Wert</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {records.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-2"><Badge variant="zinc">{r.type}</Badge></td>
                <td className="px-4 py-2 font-mono text-xs">
                  <span className="text-zinc-100">{r.name}</span>
                  <span className="ml-2 text-[10px] text-muted-foreground">{r.note}</span>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{r.value}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => copy(i, r.value)}
                    className="rounded p-1 text-zinc-500 hover:text-zinc-200"
                    title="Wert kopieren"
                    type="button"
                  >
                    {copied === i ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Hinweis: <code className="font-mono text-zinc-300">@</code> steht für die Root-Domain. Manche DNS-Provider erwarten stattdessen <code className="font-mono text-zinc-300">{domain}</code> oder ein leeres Feld.
      </p>
    </div>
  );
}
