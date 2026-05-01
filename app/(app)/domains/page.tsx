import Link from "next/link";
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
          <Button asChild>
            <Link href="/domains/new">+ Domain hinzufügen</Link>
          </Button>
        }
      />
      <DomainsListClient domains={domains} />
    </div>
  );
}
