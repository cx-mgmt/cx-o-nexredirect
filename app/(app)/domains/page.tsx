import Link from "next/link";
import { FileDown } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { DomainsListClient, type DomainListRow } from "./BulkSunsetClient";

export const dynamic = "force-dynamic";

function getDomains(): DomainListRow[] {
  return getDb()
    .prepare(`
      SELECT d.id, d.domain, d.status, d.target_url, d.group_id, d.sunset_config,
        g.name AS group_name, g.target_url AS group_target,
        (SELECT COUNT(*) FROM hits h WHERE h.domain_id = d.id) AS total_hits,
        (SELECT MAX(ts) FROM hits h WHERE h.domain_id = d.id) AS last_hit
      FROM domains d
      LEFT JOIN domain_groups g ON g.id = d.group_id
      ORDER BY d.created_at DESC
    `)
    .all() as DomainListRow[];
}

export default function DomainsPage() {
  const domains = getDomains();

  return (
    <div>
      <PageHeader
        title="Domains"
        description="Alle verwalteten Redirect-Domains"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/api/domains/export.csv" download><FileDown className="mr-1 h-3 w-3" />CSV</a>
            </Button>
            <Button asChild>
              <Link href="/domains/new">+ Domain hinzufügen</Link>
            </Button>
          </div>
        }
      />
      <DomainsListClient domains={domains} />
    </div>
  );
}
