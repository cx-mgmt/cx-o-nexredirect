import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDb, type DomainRow, type DomainGroupRow } from "@/lib/db";
import { HitsLineChart } from "@/components/charts/HitsLineChart";
import { DomainActions } from "./DomainActions";

export const dynamic = "force-dynamic";

export default async function DomainDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const domain = db.prepare("SELECT * FROM domains WHERE id = ?").get(Number(id)) as DomainRow | undefined;
  if (!domain) notFound();

  const group = domain.group_id
    ? (db.prepare("SELECT * FROM domain_groups WHERE id = ?").get(domain.group_id) as DomainGroupRow | undefined)
    : null;

  const since30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const hits24h = (db.prepare("SELECT COUNT(*) AS n FROM hits WHERE domain_id = ? AND ts > ?").get(domain.id, Date.now() - 24 * 60 * 60 * 1000) as { n: number }).n;
  const hits30d = (db.prepare("SELECT COUNT(*) AS n FROM hits WHERE domain_id = ? AND ts > ?").get(domain.id, since30d) as { n: number }).n;
  const hitsTotal = (db.prepare("SELECT COUNT(*) AS n FROM hits WHERE domain_id = ?").get(domain.id) as { n: number }).n;

  const dailyRows = db.prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS day, COUNT(*) AS hits
    FROM hits WHERE domain_id = ? AND ts > ?
    GROUP BY day ORDER BY day
  `).all(domain.id, since30d) as { day: string; hits: number }[];

  const target = domain.target_url ?? group?.target_url ?? null;

  return (
    <div>
      <PageHeader
        title={domain.domain}
        description={`Status: ${domain.status} • Code ${domain.redirect_code}`}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/domains"><ArrowLeft className="mr-1 h-3 w-3" />Zurück</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 p-8 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Konfiguration</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="Status"><StatusBadge status={domain.status} /></Row>
            <Row k="Ziel">
              {target ? (
                <a href={target} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-400 hover:underline">
                  {target} <ExternalLink className="h-3 w-3" />
                </a>
              ) : "—"}
            </Row>
            {group && <Row k="Gruppe"><Badge variant="blue">{group.name}</Badge></Row>}
            <Row k="Code">
              {domain.redirect_code}
              {domain.redirect_code === 301 && <span className="ml-1 text-[10px] text-amber-400" title="301 wird vom Browser gecacht">⚠</span>}
            </Row>
            <Row k="Pfad übernehmen">{domain.preserve_path ? "ja" : "nein"}</Row>
            <Row k="www-Subdomain">{domain.include_www ? "ja" : "nein"}</Row>
            <Row k="Verifiziert">{domain.verified_at ? new Date(domain.verified_at).toLocaleString("de-DE") : "—"}</Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Hits</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="Letzte 24h">{hits24h.toLocaleString("de-DE")}</Row>
            <Row k="Letzte 30 Tage">{hits30d.toLocaleString("de-DE")}</Row>
            <Row k="Gesamt">{hitsTotal.toLocaleString("de-DE")}</Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Aktionen</CardTitle></CardHeader>
          <CardContent>
            <DomainActions id={domain.id} status={domain.status} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Hits letzte 30 Tage</CardTitle>
            <CardDescription>Tagesgenaue Aufrufe</CardDescription>
          </CardHeader>
          <CardContent>
            <HitsLineChart data={dailyRows} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-800/40 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge variant="green">aktiv</Badge>;
  if (status === "pending") return <Badge variant="amber">wartet</Badge>;
  return <Badge variant="destructive">{status}</Badge>;
}
