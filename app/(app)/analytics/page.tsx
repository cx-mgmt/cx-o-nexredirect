import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/lib/db";
import { HitsLineChart } from "@/components/charts/HitsLineChart";
import { TopDomainsBarChart } from "@/components/charts/TopDomainsBarChart";
import { CountryPie } from "@/components/charts/CountryPie";
import { ExportPdfButton } from "./ExportPdfButton";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

export const dynamic = "force-dynamic";

function getStats() {
  const db = getDb();
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const daily = db.prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS day, COUNT(*) AS hits
    FROM hits WHERE ts > ?
    GROUP BY day ORDER BY day
  `).all(since) as { day: string; hits: number }[];

  const top = db.prepare(`
    SELECT d.domain, COUNT(h.id) AS hits
    FROM hits h JOIN domains d ON d.id = h.domain_id
    WHERE h.ts > ?
    GROUP BY d.domain ORDER BY hits DESC LIMIT 10
  `).all(since) as { domain: string; hits: number }[];

  const byCountry = db.prepare(`
    SELECT COALESCE(country,'??') AS country, COUNT(*) AS hits
    FROM hits WHERE ts > ?
    GROUP BY country ORDER BY hits DESC LIMIT 8
  `).all(since) as { country: string; hits: number }[];

  const dead = db.prepare(`
    SELECT d.id, d.domain, d.target_url, d.created_at
    FROM domains d
    WHERE d.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM hits h WHERE h.domain_id = d.id AND h.ts > ?)
    ORDER BY d.created_at
  `).all(Date.now() - 90 * 24 * 60 * 60 * 1000) as { id: number; domain: string; target_url: string | null; created_at: number }[];

  return { daily, top, byCountry, dead };
}

export default function AnalyticsPage() {
  const s = getStats();

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Hit-Statistiken letzte 30 Tage"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/api/hits/export.csv?days=30" download><FileDown className="mr-1 h-3 w-3" />Hits CSV</a>
            </Button>
            <ExportPdfButton />
          </div>
        }
      />

      <div className="space-y-4 p-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Hits pro Tag</CardTitle></CardHeader>
            <CardContent><HitsLineChart data={s.daily} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Top 10 Domains</CardTitle></CardHeader>
            <CardContent><TopDomainsBarChart data={s.top} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Top Länder</CardTitle></CardHeader>
            <CardContent><CountryPie data={s.byCountry} /></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Tote Domains</CardTitle>
              <CardDescription>Aktive Domains ohne Hits in den letzten 90 Tagen — kandidaten zum Kündigen</CardDescription>
            </CardHeader>
            <CardContent>
              {s.dead.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Keine — alle aktiven Domains werden genutzt.</p>
              ) : (
                <ul className="divide-y divide-zinc-800/70">
                  {s.dead.map((d) => (
                    <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="font-medium">{d.domain}</span>
                      <Badge variant="amber">0 Hits / 90d</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
