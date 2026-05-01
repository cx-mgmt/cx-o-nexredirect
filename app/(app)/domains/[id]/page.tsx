import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDb, parseSunset, getSetting, type DomainRow, type DomainGroupRow } from "@/lib/db";
import { HitsLineChart } from "@/components/charts/HitsLineChart";
import { DomainActions } from "./DomainActions";
import { SunsetEditor } from "./SunsetEditor";
import { DomainEditForm } from "./DomainEditForm";
import { DnsRecordsCard } from "./DnsRecordsCard";

export const dynamic = "force-dynamic";

export default async function DomainDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const domain = db.prepare("SELECT * FROM domains WHERE id = ?").get(Number(id)) as DomainRow | undefined;
  if (!domain) notFound();

  const group = domain.group_id
    ? (db.prepare("SELECT * FROM domain_groups WHERE id = ?").get(domain.group_id) as DomainGroupRow | undefined)
    : null;

  const since24h = Date.now() - 24 * 60 * 60 * 1000;
  const since30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const hits24h = (db.prepare("SELECT COUNT(*) AS n FROM hits WHERE domain_id = ? AND ts > ?").get(domain.id, since24h) as { n: number }).n;
  const hits30d = (db.prepare("SELECT COUNT(*) AS n FROM hits WHERE domain_id = ? AND ts > ?").get(domain.id, since30d) as { n: number }).n;
  const hitsTotal = (db.prepare("SELECT COUNT(*) AS n FROM hits WHERE domain_id = ?").get(domain.id) as { n: number }).n;
  const visitors30d = (db.prepare("SELECT COUNT(DISTINCT ip_hash) AS n FROM hits WHERE domain_id = ? AND ts > ?").get(domain.id, since30d) as { n: number }).n;
  const visitorsTotal = (db.prepare("SELECT COUNT(DISTINCT ip_hash) AS n FROM hits WHERE domain_id = ?").get(domain.id) as { n: number }).n;

  const dailyRows = db.prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS day, COUNT(*) AS hits
    FROM hits WHERE domain_id = ? AND ts > ?
    GROUP BY day ORDER BY day
  `).all(domain.id, since30d) as { day: string; hits: number }[];

  const target = domain.target_url ?? group?.target_url ?? null;
  const serverIpv4 = getSetting("server_ip");
  const serverIpv6 = getSetting("server_ipv6");

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
          <CardHeader>
            <CardTitle className="text-sm">Konfiguration</CardTitle>
            <CardDescription className="text-xs">
              Status: <StatusInline status={domain.status} /> • Verifiziert: {domain.verified_at ? new Date(domain.verified_at).toLocaleDateString("de-DE") : "—"}
              {target && <> • Aktuell: <a href={target} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">{target}<ExternalLink className="ml-0.5 inline h-3 w-3" /></a></>}
              {group && <> • Gruppe: <span className="text-cyan-400">{group.name}</span></>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DomainEditForm
              domainId={domain.id}
              initial={{
                target_url: domain.target_url,
                group_id: domain.group_id,
                redirect_code: domain.redirect_code,
                preserve_path: domain.preserve_path,
                include_www: domain.include_www,
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Hits</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="Letzte 24h">{hits24h.toLocaleString("de-DE")}</Row>
            <Row k="30 Tage">{hits30d.toLocaleString("de-DE")} <span className="text-xs text-muted-foreground">({visitors30d.toLocaleString("de-DE")} Besucher)</span></Row>
            <Row k="Gesamt">{hitsTotal.toLocaleString("de-DE")} <span className="text-xs text-muted-foreground">({visitorsTotal.toLocaleString("de-DE")} Besucher)</span></Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Aktionen</CardTitle></CardHeader>
          <CardContent>
            <DomainActions id={domain.id} status={domain.status} hitsTotal={hitsTotal} domainName={domain.domain} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">DNS-Records</CardTitle>
            <CardDescription className="text-xs">Alle aktuell für diese Domain veröffentlichten DNS-Einträge.</CardDescription>
          </CardHeader>
          <CardContent>
            <DnsRecordsCard domainId={domain.id} expectedIpv4={serverIpv4} expectedIpv6={serverIpv6} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Abschaltungs-Hinweis</CardTitle>
            <CardDescription className="text-xs">Optional Hinweisseite vor Redirect.</CardDescription>
          </CardHeader>
          <CardContent>
            <SunsetEditor domainId={domain.id} initial={parseSunset(domain)} />
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

function StatusInline({ status }: { status: string }) {
  if (status === "active") return <span className="text-green-400">aktiv</span>;
  if (status === "pending") return <span className="text-amber-400">wartet</span>;
  return <span className="text-destructive">{status}</span>;
}
