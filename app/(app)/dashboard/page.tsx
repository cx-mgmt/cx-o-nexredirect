import Link from "next/link";
import { Globe, MousePointerClick, Layers, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/lib/db";
import { HitsLineChart } from "@/components/charts/HitsLineChart";
import { TopDomainsBarChart } from "@/components/charts/TopDomainsBarChart";

export const dynamic = "force-dynamic";

function getStats() {
  const db = getDb();
  const since30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const since24h = Date.now() - 24 * 60 * 60 * 1000;

  const totalDomains = (db.prepare("SELECT COUNT(*) AS n FROM domains").get() as { n: number }).n;
  const activeDomains = (db.prepare("SELECT COUNT(*) AS n FROM domains WHERE status='active'").get() as { n: number }).n;
  const pendingDomains = (db.prepare("SELECT COUNT(*) AS n FROM domains WHERE status='pending'").get() as { n: number }).n;
  const groups = (db.prepare("SELECT COUNT(*) AS n FROM domain_groups").get() as { n: number }).n;
  const hits24h = (db.prepare("SELECT COUNT(*) AS n FROM hits WHERE ts > ?").get(since24h) as { n: number }).n;
  const hits30d = (db.prepare("SELECT COUNT(*) AS n FROM hits WHERE ts > ?").get(since30d) as { n: number }).n;

  const dailyRows = db.prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS day, COUNT(*) AS hits
    FROM hits WHERE ts > ?
    GROUP BY day ORDER BY day
  `).all(since30d) as { day: string; hits: number }[];

  const topRows = db.prepare(`
    SELECT d.domain, COUNT(h.id) AS hits
    FROM hits h JOIN domains d ON d.id = h.domain_id
    WHERE h.ts > ?
    GROUP BY d.domain
    ORDER BY hits DESC LIMIT 10
  `).all(since30d) as { domain: string; hits: number }[];

  return { totalDomains, activeDomains, pendingDomains, groups, hits24h, hits30d, dailyRows, topRows };
}

export default function DashboardPage() {
  const s = getStats();

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Überblick über deine Domains und Redirects"
        actions={
          <Button asChild size="sm">
            <Link href="/domains/new">+ Domain hinzufügen</Link>
          </Button>
        }
      />

      <div className="space-y-6 p-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard icon={<Globe className="h-4 w-4" />} label="Domains" value={s.totalDomains} sub={`${s.activeDomains} aktiv`} />
          <StatCard icon={<AlertCircle className="h-4 w-4" />} label="Wartend" value={s.pendingDomains} sub="DNS-Verify nötig" />
          <StatCard icon={<MousePointerClick className="h-4 w-4" />} label="Hits (24h)" value={s.hits24h} sub={`${s.hits30d} in 30 Tagen`} />
          <StatCard icon={<Layers className="h-4 w-4" />} label="Gruppen" value={s.groups} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Hits letzte 30 Tage</CardTitle>
              <CardDescription>Aggregiert über alle Domains</CardDescription>
            </CardHeader>
            <CardContent>
              <HitsLineChart data={s.dailyRows} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Top Domains</CardTitle>
              <CardDescription>Hits letzte 30 Tage</CardDescription>
            </CardHeader>
            <CardContent>
              <TopDomainsBarChart data={s.topRows} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <p className="mt-2 text-3xl font-semibold tabular-nums">{value.toLocaleString("de-DE")}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
