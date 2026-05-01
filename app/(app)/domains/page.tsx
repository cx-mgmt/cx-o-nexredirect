import Link from "next/link";
import { CheckCircle2, Clock, AlertCircle, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type DomainListRow = {
  id: number;
  domain: string;
  status: "pending" | "active" | "error";
  target_url: string | null;
  group_id: number | null;
  group_name: string | null;
  group_target: string | null;
  total_hits: number;
  last_hit: number | null;
};

function getDomains(): DomainListRow[] {
  return getDb()
    .prepare(`
      SELECT d.id, d.domain, d.status, d.target_url, d.group_id,
        g.name AS group_name, g.target_url AS group_target,
        (SELECT COUNT(*) FROM hits h WHERE h.domain_id = d.id) AS total_hits,
        (SELECT MAX(ts) FROM hits h WHERE h.domain_id = d.id) AS last_hit
      FROM domains d
      LEFT JOIN domain_groups g ON g.id = d.group_id
      ORDER BY d.created_at DESC
    `)
    .all() as DomainListRow[];
}

function timeAgo(ts: number | null): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "gerade eben";
  if (m < 60) return `vor ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} h`;
  const d = Math.floor(h / 24);
  return `vor ${d} d`;
}

export default function DomainsPage() {
  const domains = getDomains();

  return (
    <div>
      <PageHeader
        title="Domains"
        description="Alle verwalteten Redirect-Domains"
        actions={
          <Button asChild>
            <Link href="/domains/new">+ Domain hinzufügen</Link>
          </Button>
        }
      />

      <div className="p-8">
        {domains.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-muted-foreground">Noch keine Domain angelegt.</p>
              <Button asChild>
                <Link href="/domains/new">Erste Domain hinzufügen</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-800/70 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium">Domain</th>
                    <th className="px-6 py-3 text-left font-medium">Status</th>
                    <th className="px-6 py-3 text-left font-medium">Ziel</th>
                    <th className="px-6 py-3 text-right font-medium">Hits</th>
                    <th className="px-6 py-3 text-left font-medium">Letzter Hit</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {domains.map((d) => (
                    <tr key={d.id} className="hover:bg-zinc-900/40">
                      <td className="px-6 py-3 font-medium text-zinc-100">{d.domain}</td>
                      <td className="px-6 py-3">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">
                        <span className="truncate">{d.target_url || d.group_target || "—"}</span>
                        {d.group_name && <span className="ml-2 text-xs text-cyan-400">({d.group_name})</span>}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums">{d.total_hits.toLocaleString("de-DE")}</td>
                      <td className="px-6 py-3 text-muted-foreground">{timeAgo(d.last_hit)}</td>
                      <td className="px-6 py-3 text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/domains/${d.id}`}>
                            Details <ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "pending" | "active" | "error" }) {
  if (status === "active") {
    return <Badge variant="green"><CheckCircle2 className="mr-1 h-3 w-3" />aktiv</Badge>;
  }
  if (status === "pending") {
    return <Badge variant="amber"><Clock className="mr-1 h-3 w-3" />wartet</Badge>;
  }
  return <Badge variant="destructive"><AlertCircle className="mr-1 h-3 w-3" />fehler</Badge>;
}
