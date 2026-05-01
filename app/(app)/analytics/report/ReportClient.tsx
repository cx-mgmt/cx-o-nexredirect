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

const NR_LOGO = (
  <svg className="cx-logo" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="rep-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0891b2" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
    </defs>
    <rect width="80" height="80" rx="16" fill="#fff" stroke="#e5e7eb" />
    <text x="40" y="56" textAnchor="middle" fontFamily="Georgia,'Times New Roman',serif" fontSize="44" fontWeight="400">
      <tspan fill="#09090b">n</tspan>
      <tspan fill="url(#rep-grad)">r</tspan>
    </text>
    <line x1="22" y1="64" x2="58" y2="64" stroke="url(#rep-grad)" strokeWidth="1" opacity="0.5" />
  </svg>
);

export function ReportClient({ data }: { data: ReportData; logo?: React.ReactNode }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("print") === "1") {
      setTimeout(() => window.print(), 1200);
    }
  }, []);

  const s = data.sections;
  const generatedDate = new Date(data.generatedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
  const periodFrom = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toLocaleDateString("de-DE");
  const periodTo = new Date().toLocaleDateString("de-DE");

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 0; }

        @media screen {
          .report-shell { background: #e5e5e5; min-height: 100vh; padding: 16px 0 64px; }
          .report-page { box-shadow: 0 0 12px rgba(0,0,0,.18); margin: 16px auto; }
          .toolbar { position: sticky; top: 0; z-index: 10; }
        }

        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          .no-print { display: none !important; }
          .report-shell { background: #fff !important; padding: 0 !important; }
          .report-page { box-shadow: none !important; margin: 0 !important; }
          aside { display: none !important; }
        }

        :root {
          --rep-cyan: #0891b2;
          --rep-cyan-dark: #047481;
          --rep-cyan-light: #ecfeff;
          --rep-emerald: #059669;
          --rep-emerald-light: #d1fae5;
          --rep-dark: #1f2937;
          --rep-gray: #6b7280;
          --rep-light: #f3f4f6;
          --rep-border: #e5e7eb;
        }

        .report-shell {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          font-size: 10pt;
          line-height: 1.55;
          color: var(--rep-dark);
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .report-page {
          width: 210mm;
          min-height: 297mm;
          background: #fff;
          padding: 18mm 18mm 18mm 18mm;
          position: relative;
          page-break-after: always;
          break-after: page;
          box-sizing: border-box;
        }
        .report-page:last-child { page-break-after: avoid; break-after: avoid; }

        .rep-hdr {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--rep-border);
          padding-bottom: 5mm;
          margin-bottom: 8mm;
          font-size: 8pt;
          color: var(--rep-gray);
        }
        .cx-logo { height: 11mm; width: auto; display: block; }

        .rep-h1 {
          font-size: 18pt;
          color: var(--rep-cyan-dark);
          margin: 0 0 1mm 0;
          font-weight: bold;
        }
        .rep-h1::after {
          content: "";
          display: block;
          width: 40mm;
          height: 2px;
          background: linear-gradient(90deg, var(--rep-cyan), var(--rep-emerald));
          margin-top: 3mm;
          margin-bottom: 6mm;
        }
        .rep-h2 {
          font-size: 12pt;
          color: var(--rep-dark);
          margin: 6mm 0 2mm 0;
          font-weight: bold;
        }
        .rep-p { margin: 0 0 3mm 0; }
        .rep-small { font-size: 8.5pt; color: var(--rep-gray); }

        .kicker {
          font-size: 9pt;
          color: var(--rep-cyan);
          font-weight: bold;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: 4mm;
        }
        .big-title {
          font-size: 28pt;
          font-weight: bold;
          color: var(--rep-dark);
          line-height: 1.15;
          margin: 0 0 2mm 0;
        }
        .sub-title {
          font-size: 14pt;
          color: var(--rep-cyan);
          margin: 0 0 4mm 0;
        }
        .divider {
          width: 40mm;
          height: 2.5px;
          background: linear-gradient(90deg, var(--rep-cyan), var(--rep-emerald));
          margin: 5mm 0 8mm 0;
        }

        table.facts {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid var(--rep-border);
          background: var(--rep-light);
          margin-bottom: 6mm;
          page-break-inside: avoid;
        }
        table.facts td {
          padding: 3mm 4mm;
          border-bottom: 1px solid var(--rep-border);
          vertical-align: middle;
        }
        table.facts tr:last-child td { border-bottom: none; }
        table.facts td.label { width: 45mm; font-weight: bold; font-size: 9pt; color: var(--rep-gray); }

        table.data {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid var(--rep-border);
          margin-bottom: 4mm;
          font-size: 9.5pt;
        }
        table.data th {
          background: var(--rep-cyan);
          color: white;
          font-weight: bold;
          padding: 2.5mm 3mm;
          text-align: left;
          font-size: 9.5pt;
        }
        table.data td {
          padding: 2.2mm 3mm;
          border-bottom: 1px solid var(--rep-border);
          vertical-align: top;
        }
        table.data tr:nth-child(even) td { background: var(--rep-light); }
        table.data .num { text-align: right; font-variant-numeric: tabular-nums; }
        table.data .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 8.5pt; }

        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr;
          gap: 4mm;
          margin: 4mm 0 6mm 0;
        }
        .stat-card {
          background: var(--rep-cyan-light);
          border: 1px solid var(--rep-cyan);
          padding: 4mm;
          border-radius: 3px;
        }
        .stat-label {
          font-size: 8pt;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--rep-cyan-dark);
          font-weight: bold;
        }
        .stat-value {
          font-size: 22pt;
          font-weight: bold;
          color: var(--rep-dark);
          line-height: 1.1;
          margin-top: 2mm;
        }
        .stat-sub {
          font-size: 8.5pt;
          color: var(--rep-gray);
          margin-top: 1mm;
        }

        .callout {
          background: var(--rep-cyan-light);
          border-left: 4px solid var(--rep-cyan);
          padding: 4mm 5mm;
          margin: 5mm 0;
          border-radius: 2px;
          page-break-inside: avoid;
        }
        .callout-title {
          font-weight: bold;
          color: var(--rep-cyan-dark);
          font-size: 10pt;
          margin-bottom: 2mm;
        }
        .callout-body { font-size: 9.5pt; line-height: 1.5; }

        .chart-box {
          border: 1px solid var(--rep-border);
          border-radius: 3px;
          padding: 4mm;
          margin: 3mm 0 5mm 0;
          background: #fff;
          page-break-inside: avoid;
        }

        .cover-spacer { height: 18mm; }

        ul.bullet-list { list-style: none; padding: 0; margin: 0 0 3mm 0; }
        ul.bullet-list li {
          position: relative;
          padding-left: 6mm;
          margin-bottom: 2mm;
          font-size: 9.5pt;
        }
        ul.bullet-list li::before {
          content: "●";
          color: var(--rep-cyan);
          position: absolute;
          left: 0;
          top: 0;
        }
      `}</style>

      <div className="report-shell">
        <div className="toolbar no-print flex items-center justify-between border-b border-zinc-800/70 bg-zinc-950/95 px-6 py-3 text-zinc-100 backdrop-blur">
          <Link href="/analytics" className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Zurück
          </Link>
          <button onClick={() => window.print()} className="flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-cyan-400">
            <Printer className="h-4 w-4" /> Als PDF speichern
          </button>
        </div>

        {/* COVER */}
        <div className="report-page">
          <div className="rep-hdr">
            {NR_LOGO}
            <div>{s.title}</div>
          </div>
          <div className="cover-spacer" />
          <div className="kicker">Domain-Redirect-Report</div>
          <div className="big-title">{s.title}</div>
          <div className="sub-title">Statistik-Report · CoreX NexRedirect</div>
          <div className="divider" />

          <p className="rep-p">
            Übersicht über Domain-Aktivität und Nutzung im Zeitraum vom <strong>{periodFrom}</strong> bis <strong>{periodTo}</strong>.
            Die Daten basieren auf der lokalen Hit-Datenbank des NexRedirect-Servers.
          </p>

          <p className="rep-p">
            Bot-Traffic und automatisierte Anfragen sind herausgefiltert; eindeutige Besucher werden über
            täglich rotierende IP-Hashes ermittelt (DSGVO-konform).
          </p>

          <div style={{ height: "4mm" }} />

          <table className="facts">
            <tbody>
              <tr><td className="label">Berichtszeitraum</td><td>letzte {data.days} Tage ({periodFrom} – {periodTo})</td></tr>
              <tr><td className="label">Domains gesamt</td><td>{data.totalDomains.toLocaleString("de-DE")} <span className="rep-small">({data.activeDomains} aktiv)</span></td></tr>
              <tr><td className="label">Hits im Zeitraum</td><td><strong>{data.totalHits.toLocaleString("de-DE")}</strong></td></tr>
              <tr><td className="label">Eindeutige Besucher</td><td>{data.uniqueIps.toLocaleString("de-DE")}</td></tr>
              <tr><td className="label">Erstellt am</td><td>{generatedDate}</td></tr>
            </tbody>
          </table>

          <p className="rep-h2">Inhalt</p>
          <p style={{ lineHeight: 1.9 }}>
            {[
              s.summary && "1. Zusammenfassung",
              s.daily && "2. Hits pro Tag",
              s.top && "3. Top Domains",
              s.country && "4. Geografische Verteilung",
              s.dead && "5. Tote Domains",
              s.perDomain && "6. Detail pro Domain",
              s.hits && "7. Letzte Aufrufe",
            ].filter(Boolean).map((line, i) => (
              <span key={i}>{line}<br /></span>
            ))}
          </p>
        </div>

        {/* Summary */}
        {s.summary && (
          <div className="report-page">
            <div className="rep-hdr">{NR_LOGO}<div>{s.title}</div></div>
            <h1 className="rep-h1">Zusammenfassung</h1>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Domains</div>
                <div className="stat-value">{data.totalDomains.toLocaleString("de-DE")}</div>
                <div className="stat-sub">{data.activeDomains} aktiv</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Hits</div>
                <div className="stat-value">{data.totalHits.toLocaleString("de-DE")}</div>
                <div className="stat-sub">in {data.days} Tagen</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Besucher</div>
                <div className="stat-value">{data.uniqueIps.toLocaleString("de-DE")}</div>
                <div className="stat-sub">eindeutig</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Ø Hits/Tag</div>
                <div className="stat-value">{Math.round(data.totalHits / data.days).toLocaleString("de-DE")}</div>
                <div className="stat-sub">über Zeitraum</div>
              </div>
            </div>

            {data.daily.length > 0 && (
              <>
                <h2 className="rep-h2">Verlauf</h2>
                <div className="chart-box" style={{ height: "70mm" }}>
                  <HitsLineChart data={data.daily} />
                </div>
              </>
            )}

            <div className="callout">
              <div className="callout-title">Hinweis zur Erfassung</div>
              <div className="callout-body">
                Bots, Crawler und automatisierte Monitoring-Anfragen werden serverseitig herausgefiltert
                (User-Agent-Match, HEAD/OPTIONS-Requests, Standard-Pfade wie /favicon.ico). Eindeutige
                Besucher basieren auf täglich rotierenden IP-Hashes — kein Klartext gespeichert.
              </div>
            </div>
          </div>
        )}

        {/* Top Domains */}
        {s.top && data.top.length > 0 && (
          <div className="report-page">
            <div className="rep-hdr">{NR_LOGO}<div>{s.title}</div></div>
            <h1 className="rep-h1">Top Domains</h1>

            <p className="rep-p">Die meistgenutzten Domains im Berichtszeitraum, sortiert nach Hit-Count.</p>

            <div className="chart-box" style={{ height: "75mm" }}>
              <TopDomainsBarChart data={data.top.slice(0, 12)} />
            </div>

            <table className="data">
              <thead>
                <tr><th>Domain</th><th style={{ width: "30mm" }} className="num">Hits</th><th style={{ width: "30mm" }} className="num">Anteil</th></tr>
              </thead>
              <tbody>
                {data.top.slice(0, 30).map((r) => (
                  <tr key={r.domain}>
                    <td className="mono">{r.domain}</td>
                    <td className="num">{r.hits.toLocaleString("de-DE")}</td>
                    <td className="num">{data.totalHits ? ((r.hits / data.totalHits) * 100).toFixed(1) : "0"}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Country */}
        {s.country && data.country.length > 0 && (
          <div className="report-page">
            <div className="rep-hdr">{NR_LOGO}<div>{s.title}</div></div>
            <h1 className="rep-h1">Geografische Verteilung</h1>

            <p className="rep-p">Aufschlüsselung der Hits nach Herkunftsland (über lokale GeoLite2-Datenbank).</p>

            <div className="chart-box" style={{ height: "85mm" }}>
              <CountryPie data={data.country.slice(0, 8)} />
            </div>

            <table className="data">
              <thead><tr><th>Land</th><th style={{ width: "30mm" }} className="num">Hits</th><th style={{ width: "30mm" }} className="num">Anteil</th></tr></thead>
              <tbody>
                {data.country.map((c) => (
                  <tr key={c.country}>
                    <td className="mono">{c.country}</td>
                    <td className="num">{c.hits.toLocaleString("de-DE")}</td>
                    <td className="num">{data.totalHits ? ((c.hits / data.totalHits) * 100).toFixed(1) : "0"}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Dead */}
        {s.dead && data.dead.length > 0 && (
          <div className="report-page">
            <div className="rep-hdr">{NR_LOGO}<div>{s.title}</div></div>
            <h1 className="rep-h1">Tote Domains</h1>

            <p className="rep-p">
              Aktive Domains ohne einen einzigen Hit in den letzten 90 Tagen. Kandidaten zur
              Auflösung oder Kündigung — bevor erneut Verlängerungsgebühren anfallen.
            </p>

            <table className="data">
              <thead><tr><th style={{ width: "55mm" }}>Domain</th><th>Ziel</th><th style={{ width: "32mm" }}>Angelegt</th></tr></thead>
              <tbody>
                {data.dead.map((d) => (
                  <tr key={d.id}>
                    <td className="mono">{d.domain}</td>
                    <td className="mono">{d.target_url || "—"}</td>
                    <td>{new Date(d.created_at).toLocaleDateString("de-DE")}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="callout">
              <div className="callout-title">Empfehlung</div>
              <div className="callout-body">
                Domains ohne Aufrufe über 90 Tage werden mit hoher Wahrscheinlichkeit nicht mehr genutzt.
                Vor Kündigung empfiehlt sich, kurz die Suchindex-Position und die ausgehende Verlinkung
                zu prüfen, um SEO-Wert nicht versehentlich aufzugeben.
              </div>
            </div>
          </div>
        )}

        {/* Per-Domain Detail */}
        {s.perDomain && data.perDomain.length > 0 && (
          <div className="report-page">
            <div className="rep-hdr">{NR_LOGO}<div>{s.title}</div></div>
            <h1 className="rep-h1">Detail pro Domain</h1>

            <p className="rep-p">Vollständige Aufstellung aller Domains mit Hit-Zahlen für den Berichtszeitraum und insgesamt.</p>

            <table className="data">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th style={{ width: "16mm" }}>Status</th>
                  <th style={{ width: "12mm" }}>Code</th>
                  <th style={{ width: "20mm" }} className="num">Hits ({data.days}d)</th>
                  <th style={{ width: "22mm" }} className="num">Hits gesamt</th>
                  <th style={{ width: "30mm" }}>Letzter Hit</th>
                </tr>
              </thead>
              <tbody>
                {data.perDomain.map((d) => (
                  <tr key={d.id}>
                    <td className="mono">{d.domain}</td>
                    <td>{d.status}</td>
                    <td>{d.redirect_code}</td>
                    <td className="num">{d.hits_period.toLocaleString("de-DE")}</td>
                    <td className="num">{d.hits_total.toLocaleString("de-DE")}</td>
                    <td className="rep-small">{d.last_hit ? new Date(d.last_hit).toLocaleString("de-DE") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Recent hits */}
        {s.hits && data.recentHits.length > 0 && (
          <div className="report-page">
            <div className="rep-hdr">{NR_LOGO}<div>{s.title}</div></div>
            <h1 className="rep-h1">Letzte Aufrufe</h1>

            <p className="rep-p">Die jüngsten {data.recentHits.length} Hits im Berichtszeitraum (chronologisch absteigend).</p>

            <table className="data" style={{ fontSize: "8.5pt" }}>
              <thead>
                <tr>
                  <th style={{ width: "32mm" }}>Zeit</th>
                  <th>Domain</th>
                  <th style={{ width: "14mm" }}>Land</th>
                  <th>Pfad</th>
                </tr>
              </thead>
              <tbody>
                {data.recentHits.map((h, i) => (
                  <tr key={i}>
                    <td className="mono">{new Date(h.ts).toLocaleString("de-DE")}</td>
                    <td className="mono">{h.domain}</td>
                    <td>{h.country || "—"}</td>
                    <td className="mono">{(h.path || "/").slice(0, 50)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
