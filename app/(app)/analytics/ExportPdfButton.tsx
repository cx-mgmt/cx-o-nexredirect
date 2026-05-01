"use client";
import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SECTIONS = [
  { key: "summary", label: "Zusammenfassung" },
  { key: "daily", label: "Hits pro Tag (Chart)" },
  { key: "top", label: "Top Domains" },
  { key: "country", label: "Geografische Verteilung" },
  { key: "dead", label: "Tote Domains" },
  { key: "perDomain", label: "Detail pro Domain" },
  { key: "hits", label: "Letzte Aufrufe (bis 200)" },
] as const;

const PRESETS: Record<string, Record<string, boolean>> = {
  basic: { summary: true, daily: true, top: true, country: true, dead: true, perDomain: false, hits: false },
  detailed: { summary: true, daily: true, top: true, country: true, dead: true, perDomain: true, hits: true },
  minimal: { summary: true, daily: false, top: true, country: false, dead: true, perDomain: false, hits: false },
};

export function ExportPdfButton() {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(30);
  const [title, setTitle] = useState("Domain-Redirect-Report");
  const [sel, setSel] = useState<Record<string, boolean>>(PRESETS.basic);

  function applyPreset(name: keyof typeof PRESETS) {
    setSel(PRESETS[name]);
  }

  function build() {
    const params = new URLSearchParams();
    params.set("days", String(days));
    params.set("title", title);
    params.set("print", "1");
    for (const s of SECTIONS) {
      params.set(s.key, sel[s.key] ? "1" : "0");
    }
    return `/analytics/report?${params.toString()}`;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <FileDown className="mr-1 h-3 w-3" />
          PDF Export
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>PDF-Report erstellen</DialogTitle>
          <DialogDescription>Auswahl was rein soll, dann wird das Druck-Dialog geöffnet (→ "Als PDF speichern").</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Vorlage</Label>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("minimal")}>Minimal</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("basic")}>Basic</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("detailed")}>Detailliert</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="title">Titel</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="days">Zeitraum (Tage)</Label>
              <Input id="days" type="number" min={1} max={365} value={days} onChange={(e) => setDays(Math.max(1, Math.min(365, Number(e.target.value) || 30)))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Inhalte</Label>
            <div className="space-y-1">
              {SECTIONS.map((s) => (
                <label key={s.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!sel[s.key]}
                    onChange={(e) => setSel((cur) => ({ ...cur, [s.key]: e.target.checked }))}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button asChild>
              <a href={build()} target="_blank" rel="noreferrer">Vorschau & PDF</a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
