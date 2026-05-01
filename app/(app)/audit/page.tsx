import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type Entry = {
  id: number;
  ts: number;
  user_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: string | null;
};

const ACTION_VARIANT: Record<string, "green" | "amber" | "blue" | "destructive" | "zinc"> = {
  "domain.create": "green",
  "domain.update": "blue",
  "domain.delete": "destructive",
  "domain.verify": "amber",
  "group.create": "green",
  "group.update": "blue",
  "group.delete": "destructive",
  "sunset.bulk": "amber",
  "domain.bulk_delete": "destructive",
  "settings.update": "blue",
  "geo.install": "green",
  "geo.remove": "destructive",
  "token.create": "green",
  "token.revoke": "destructive",
  "update.apply": "amber",
};

export default function AuditPage() {
  const rows = getDb().prepare("SELECT id, ts, user_email, action, target_type, target_id, details FROM audit_log ORDER BY ts DESC LIMIT 500").all() as Entry[];

  return (
    <div>
      <PageHeader title="Audit-Log" description="Alle administrativen Mutationen — bis zu 500 Einträge" />
      <div className="p-8">
        {rows.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Noch keine Aktionen geloggt.</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-800/70 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium">Zeit</th>
                    <th className="px-6 py-3 text-left font-medium">Benutzer</th>
                    <th className="px-6 py-3 text-left font-medium">Aktion</th>
                    <th className="px-6 py-3 text-left font-medium">Ziel</th>
                    <th className="px-6 py-3 text-left font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-900/40">
                      <td className="px-6 py-2.5 font-mono text-xs">{new Date(r.ts).toLocaleString("de-DE")}</td>
                      <td className="px-6 py-2.5 text-xs">{r.user_email || "—"}</td>
                      <td className="px-6 py-2.5"><Badge variant={ACTION_VARIANT[r.action] || "zinc"}>{r.action}</Badge></td>
                      <td className="px-6 py-2.5 text-xs text-muted-foreground">{r.target_type ? `${r.target_type}#${r.target_id ?? ""}` : "—"}</td>
                      <td className="px-6 py-2.5 font-mono text-[10px] text-muted-foreground">{(r.details || "").slice(0, 120)}</td>
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
