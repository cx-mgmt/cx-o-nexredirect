"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCcw, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DomainActions({ id, status }: { id: number; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"verify" | "delete" | null>(null);
  const [msg, setMsg] = useState("");

  async function verify() {
    setBusy("verify");
    setMsg("");
    try {
      const res = await fetch(`/api/domains/${id}/verify`, { method: "POST" });
      const d = await res.json();
      setMsg(d.ok ? "DNS OK — Domain aktiviert" : `DNS unvollständig: ${d.result?.missing?.join(", ") ?? ""}`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function del() {
    if (!confirm("Domain wirklich löschen? Hits bleiben gelöscht.")) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/domains/${id}`, { method: "DELETE" });
      if (res.ok) router.push("/domains");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={verify} variant="outline" size="sm" className="w-full" disabled={busy !== null}>
        {busy === "verify" ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCcw className="mr-2 h-3 w-3" />}
        DNS erneut prüfen
      </Button>
      <Button onClick={del} variant="destructive" size="sm" className="w-full" disabled={busy !== null}>
        {busy === "delete" ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Trash2 className="mr-2 h-3 w-3" />}
        Domain löschen
      </Button>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      {status === "pending" && <p className="text-xs text-amber-300/80">Domain ist noch nicht aktiv. DNS muss korrekt eingetragen sein, bevor Aufrufe weitergeleitet werden.</p>}
    </div>
  );
}
