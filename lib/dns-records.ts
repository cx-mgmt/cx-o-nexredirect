import dns from "dns/promises";

export type DnsRecords = {
  domain: string;
  A: string[];
  AAAA: string[];
  CNAME: string[];
  MX: { exchange: string; priority: number }[];
  NS: string[];
  TXT: string[];
  SOA: { nsname: string; hostmaster: string; serial: number; refresh: number; retry: number; expire: number; minttl: number } | null;
  CAA: { issue?: string; issuewild?: string; iodef?: string; critical?: number }[];
  errors: Record<string, string>;
};

async function safe<T>(p: Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await p };
  } catch (e) {
    const code = (e as { code?: string }).code;
    return { ok: false, error: code === "ENODATA" ? "no records" : code || (e instanceof Error ? e.message : String(e)) };
  }
}

export async function getAllDnsRecords(domain: string): Promise<DnsRecords> {
  const [a, aaaa, cname, mx, ns, txt, soa, caa] = await Promise.all([
    safe(dns.resolve4(domain)),
    safe(dns.resolve6(domain)),
    safe(dns.resolveCname(domain)),
    safe(dns.resolveMx(domain)),
    safe(dns.resolveNs(domain)),
    safe(dns.resolveTxt(domain)),
    safe(dns.resolveSoa(domain)),
    safe(dns.resolveCaa(domain)),
  ]);

  const errors: Record<string, string> = {};
  if (!a.ok && a.error !== "no records") errors.A = a.error;
  if (!aaaa.ok && aaaa.error !== "no records") errors.AAAA = aaaa.error;
  if (!cname.ok && cname.error !== "no records") errors.CNAME = cname.error;
  if (!mx.ok && mx.error !== "no records") errors.MX = mx.error;
  if (!ns.ok && ns.error !== "no records") errors.NS = ns.error;
  if (!txt.ok && txt.error !== "no records") errors.TXT = txt.error;
  if (!soa.ok && soa.error !== "no records") errors.SOA = soa.error;
  if (!caa.ok && caa.error !== "no records") errors.CAA = caa.error;

  return {
    domain,
    A: a.ok ? a.value : [],
    AAAA: aaaa.ok ? aaaa.value : [],
    CNAME: cname.ok ? cname.value : [],
    MX: mx.ok ? mx.value : [],
    NS: ns.ok ? ns.value : [],
    TXT: txt.ok ? txt.value.map((parts) => parts.join("")) : [],
    SOA: soa.ok ? soa.value : null,
    CAA: caa.ok ? (caa.value as DnsRecords["CAA"]) : [],
    errors,
  };
}
