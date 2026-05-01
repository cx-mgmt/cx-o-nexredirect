"use client";
import { useEffect } from "react";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { HitsLineChart } from "@/components/charts/HitsLineChart";
import { TopDomainsBarChart } from "@/components/charts/TopDomainsBarChart";
import { CountryPie } from "@/components/charts/CountryPie";

type Sections = {
  summary: boolean;
  daily: boolean;
  top: boolean;
  country: boolean;
  perDomain: boolean;
  dead: boolean;
  hits: boolean;
  title: string;
};

type ReportData = {
  days: number;
  sections: Sections;
  totalDomains: number;
  activeDomains: number;
  totalHits: number;
  uniqueIps: number;
  daily: { day: string; hits: number }[];
  top: { domain: string; hits: number }[];
  country: { country: string; hits: number }[];
  dead: { id: number; domain: string; target_url: string | null; created_at: number }[];
  perDomain: { id: number; domain: string; target_url: string | null; redirect_code: number; status: string; hits_period: number; hits_total: number; last_hit: number | null }[];
  recentHits: { ts: number; domain: string; country: string | null; path: string | null }[];
  generatedAt: number;
};

export function ReportClient({ data, logo }: { data: ReportData; logo: React.ReactNode }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("print") === "1") {
      setTimeout(() => window.print(), 800);
    }
  }, []);

  const s = data.sections;

  return (
    <div className="report-root">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .report-root { background: white !important; color: #000 !important; }
          aside, [data-component="UpdateBanner"] { display: none !important; }
          .report-section { page-break-inside: avoid; }
          .report-page-break { page-break-after: always; }
          html, body { background: white !important; }
        }
        @page { margin: 1.5cm; }
      `}</style>

      {/* Toolbar (only visible on screen) */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800/70 bg-zinc-950/95 px-6 py-3 backdrop-blur">
        <Link href="/analytics" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-zinc-100">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-cyan-400">
          <Printer className="h-4 w-4" /> Als PDF speichern
        </button>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 p-8">
        {/* Cover */}
        <header className="report-section flex items-center gap-4 border-b border-zinc-800/70 pb-6">
          <div>{logo}</div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{s.title}</h1>
            <p className="text-sm text-muted-foreground">
              Zeitraum: letzte {data.days} Tage • Erstellt: {new Date(data.generatedAt).toLocaleString("de-DE")}
            </p>
          </div>
        </header>

        {s.summary && (
          <section className="report-section space-y-3">
            <h2 className="text-xl font-semibold">Zusammenfassung</h2>
            <div className="grid grid-cols-4 gap-3">
              <Stat label="Domains" value={data.totalDomains} sub={`${data.activeDomains} aktiv`} />
              <Stat label="Hits gesamt" value={data.totalHits} sub={`über ${data.days} Tage`} />
              <Stat label="Eindeutige Besucher" value={data.uniqueIps} sub="(IP-Hashes)" />
              <Stat label="Ø Hits/Tag" value={Math.round(data.totalHits / data.days)} />
            </div>
          </section>
        )}

        {s.daily && (
          <section className="report-section space-y-2">
            <h2 className="text-xl font-semibold">Hits pro Tag</h2>
            <div className="rounded-md border border-zinc-800/70 bg-zinc-900/30 p-4">
              <HitsLineChart data={data.daily} />
            </div>
          </section>
        )}

        {s.top && data.top.length > 0 && (
          <section className="report-section space-y-2">
            <h2 className="text-xl font-semibold">Top Domains</h2>
            <div className="rounded-md border border-zinc-800/70 bg-zinc-900/30 p-4">
              <TopDomainsBarChart data={data.top.slice(0, 15)} />
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-3 py-2 text-left">Domain</th><th className="px-3 py-2 text-right">Hits</th><th className="px-3 py-2 text-right">% gesamt</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {data.top.slice(0, 30).map((r) => (
                  <tr key={r.domain}>
                    <td className="px-3 py-1.5 font-mono text-xs">{r.domain}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.hits.toLocaleString("de-DE")}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{data.totalHits ? ((r.hits / data.totalHits) * 100).toFixed(1) : "0"}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {s.country && data.country.length > 0 && (
          <section className="report-section space-y-2">
            <h2 className="text-xl font-semibold">Geografische Verteilung</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-md border border-zinc-800/70 bg-zinc-900/30 p-4">
                <CountryPie data={data.country.slice(0, 8)} />
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2 text-left">Land</th><th className="px-3 py-2 text-right">Hits</th></tr></thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {data.country.map((c) => (
                    <tr key={c.country}><td className="px-3 py-1.5 font-mono">{c.country}</td><td className="px-3 py-1.5 text-right tabular-nums">{c.hits.toLocaleString("de-DE")}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {s.dead && data.dead.length > 0 && (
          <section className="report-section space-y-2">
            <h2 className="text-xl font-semibold">Tote Domains</h2>
            <p className="text-xs text-muted-foreground">Aktive Domains ohne Hits in den letzten 90 Tagen — Kandidaten zum Kündigen.</p>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2 text-left">Domain</th><th className="px-3 py-2 text-left">Ziel</th><th className="px-3 py-2 text-left">Angelegt</th></tr></thead>
              <tbody className="divide-y divide-zinc-800/70">
                {data.dead.map((d) => (
                  <tr key={d.id}>
                    <td className="px-3 py-1.5 font-mono">{d.domain}</td>
                    <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{d.target_url || "—"}</td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString("de-DE")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {s.perDomain && data.perDomain.length > 0 && (
          <section className="report-section space-y-2">
            <h2 className="text-xl font-semibold">Detailbericht pro Domain</h2>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Domain</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Ziel</th>
                  <th className="px-3 py-2 text-right">Hits ({data.days}d)</th>
                  <th className="px-3 py-2 text-right">Hits gesamt</th>
                  <th className="px-3 py-2 text-left">Letzter Hit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {data.perDomain.map((d) => (
                  <tr key={d.id}>
                    <td className="px-3 py-1.5 font-mono text-xs">{d.domain}</td>
                    <td className="px-3 py-1.5 text-xs">{d.status}</td>
                    <td className="px-3 py-1.5 text-xs">{d.redirect_code}</td>
                    <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground">{d.target_url || "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{d.hits_period.toLocaleString("de-DE")}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{d.hits_total.toLocaleString("de-DE")}</td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">{d.last_hit ? new Date(d.last_hit).toLocaleString("de-DE") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {s.hits && data.recentHits.length > 0 && (
          <section className="report-section space-y-2">
            <h2 className="text-xl font-semibold">Letzte Aufrufe</h2>
            <p className="text-xs text-muted-foreground">Bis zu 200 jüngste Hits im Berichts-Zeitraum.</p>
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-2 py-1.5 text-left">Zeit</th><th className="px-2 py-1.5 text-left">Domain</th><th className="px-2 py-1.5 text-left">Land</th><th className="px-2 py-1.5 text-left">Pfad</th></tr></thead>
              <tbody className="divide-y divide-zinc-800/40">
                {data.recentHits.map((h, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1 font-mono">{new Date(h.ts).toLocaleString("de-DE")}</td>
                    <td className="px-2 py-1 font-mono">{h.domain}</td>
                    <td className="px-2 py-1">{h.country || "—"}</td>
                    <td className="px-2 py-1 font-mono text-muted-foreground">{(h.path || "/").slice(0, 60)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="border-t border-zinc-800/70 pt-3 text-xs text-muted-foreground">
          Erstellt mit CoreX NexRedirect
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-md border border-zinc-800/70 bg-zinc-900/30 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString("de-DE")}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
