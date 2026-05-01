"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Cfg = {
  enabled: boolean;
  title?: string;
  message?: string;
  button_label?: string;
  sunset_date?: string;
};

export function SunsetEditor({ domainId, initial }: { domainId: number; initial: Cfg | null }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [title, setTitle] = useState(initial?.title ?? "Diese Domain wird abgeschaltet");
  const [message, setMessage] = useState(initial?.message ?? "");
  const [buttonLabel, setButtonLabel] = useState(initial?.button_label ?? "Weiter");
  const [sunsetDate, setSunsetDate] = useState(initial?.sunset_date ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const cfg = enabled
        ? { enabled, title, message, button_label: buttonLabel, sunset_date: sunsetDate || undefined }
        : null;
      const r = await fetch(`/api/domains/${domainId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sunset_config: cfg }),
      });
      if (r.ok) {
        setMsg("Gespeichert.");
        router.refresh();
      } else {
        setMsg("Fehler beim Speichern.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Hinweisseite vor Redirect anzeigen
      </label>

      {enabled && (
        <div className="space-y-3 border-l-2 border-amber-500/40 pl-3">
          <div className="space-y-1">
            <Label htmlFor="s-title" className="text-xs">Titel</Label>
            <Input id="s-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="s-msg" className="text-xs">Nachricht</Label>
            <Textarea id="s-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="z.B. Diese Domain wird zum 31.12.2026 abgeschaltet. Bitte verwende ab sofort https://test.de" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="s-btn" className="text-xs">Button-Text</Label>
              <Input id="s-btn" value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-date" className="text-xs">Abschaltdatum (optional)</Label>
              <Input id="s-date" value={sunsetDate} onChange={(e) => setSunsetDate(e.target.value)} placeholder="31.12.2026" />
            </div>
          </div>
        </div>
      )}

      <Button onClick={save} disabled={saving} size="sm" className="w-full">
        {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
        Speichern
      </Button>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
