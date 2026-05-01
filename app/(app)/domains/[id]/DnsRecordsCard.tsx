"use client";
import { useEffect, useState } from "react";
import { Loader2, RefreshCcw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Records = {
  domain: string;
  A: string[];
  AAAA: string[];
  CNAME: string[];
  MX: { exchange: string; priority: number }[];
  NS: string[];
  TXT: string[];
  SOA: { nsname: string; hostmaster: string; serial: number } | null;
  CAA: { issue?: string; issuewild?: string; iodef?: string }[];
  errors: Record<string, string>;
};

export function DnsRecordsCard({ domainId, expectedIpv4, expectedIpv6 }: { domainId: number; expectedIpv4: string | null; expectedIpv6: string | null }) {
  const [data, setData] = useState<Records | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/domains/${domainId}/dns-records`, { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [domainId]);

  if (!data) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={load} variant="outline" size="sm" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCcw className="mr-2 h-3 w-3" />}
          Aktualisieren
        </Button>
      </div>

      <RecordList type="A" values={data.A} highlight={expectedIpv4 ? [expectedIpv4] : []} empty="Kein A-Record" />
      <RecordList type="AAAA" values={data.AAAA} highlight={expectedIpv6 ? [expectedIpv6] : []} empty="Kein AAAA-Record" />
      {data.CNAME.length > 0 && <RecordList type="CNAME" values={data.CNAME} />}
      {data.MX.length > 0 && (
        <Block label="MX">
          {data.MX.map((m, i) => (
            <Row key={i} value={`${m.priority}  ${m.exchange}`} />
          ))}
        </Block>
      )}
      {data.NS.length > 0 && <RecordList type="NS" values={data.NS} />}
      {data.TXT.length > 0 && (
        <Block label="TXT">
          {data.TXT.map((t, i) => <Row key={i} value={t} mono />)}
        </Block>
      )}
      {data.CAA.length > 0 && (
        <Block label="CAA">
          {data.CAA.map((c, i) => <Row key={i} value={Object.entries(c).filter(([k]) => k !== "critical").map(([k, v]) => `${k}=${v}`).join("  ")} />)}
        </Block>
      )}
      {data.SOA && (
        <Block label="SOA">
          <Row value={`${data.SOA.nsname}  ${data.SOA.hostmaster}  serial ${data.SOA.serial}`} />
        </Block>
      )}

      {Object.keys(data.errors).length > 0 && (
        <p className="text-[11px] text-amber-400">
          DNS-Lookup-Fehler: {Object.entries(data.errors).map(([k, v]) => `${k}: ${v}`).join(" • ")}
        </p>
      )}
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Badge variant="zinc" className="mt-0.5 w-12 justify-center">{label}</Badge>
      <div className="flex-1 space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ value, match, mono }: { value: string; match?: boolean; mono?: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${mono === false ? "" : "font-mono"}`}>
      <span className="break-all text-zinc-200">{value}</span>
      {match && <CheckCircle2 className="h-3 w-3 shrink-0 text-green-400" />}
    </div>
  );
}

function RecordList({ type, values, highlight = [], empty }: { type: string; values: string[]; highlight?: string[]; empty?: string }) {
  if (values.length === 0) {
    return empty ? (
      <Block label={type}>
        <span className="text-xs italic text-muted-foreground">{empty}</span>
      </Block>
    ) : null;
  }
  return (
    <Block label={type}>
      {values.map((v, i) => <Row key={i} value={v} match={highlight.includes(v)} />)}
    </Block>
  );
}
