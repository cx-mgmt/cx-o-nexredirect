import dns from "dns/promises";
import { getSetting } from "./db";

export type DnsCheckResult = {
  ok: boolean;
  expected: { ipv4?: string; ipv6?: string };
  resolved: { a: string[]; aaaa: string[]; wwwA: string[]; wwwAaaa: string[] };
  missing: string[];
};

export async function getServerIps() {
  return {
    ipv4: getSetting("server_ip") ?? undefined,
    ipv6: getSetting("server_ipv6") ?? undefined,
  };
}

async function resolveSafe(name: string, type: "A" | "AAAA"): Promise<string[]> {
  try {
    if (type === "A") return await dns.resolve4(name);
    return await dns.resolve6(name);
  } catch {
    return [];
  }
}

export async function checkDomainDns(domain: string, includeWww: boolean): Promise<DnsCheckResult> {
  const expected = await getServerIps();
  const [a, aaaa, wwwA, wwwAaaa] = await Promise.all([
    resolveSafe(domain, "A"),
    resolveSafe(domain, "AAAA"),
    includeWww ? resolveSafe(`www.${domain}`, "A") : Promise.resolve([]),
    includeWww ? resolveSafe(`www.${domain}`, "AAAA") : Promise.resolve([]),
  ]);

  const missing: string[] = [];
  const apexHasIpv4 = expected.ipv4 ? a.includes(expected.ipv4) : a.length > 0;
  const apexHasIpv6 = expected.ipv6 ? aaaa.includes(expected.ipv6) : true;
  if (!apexHasIpv4) missing.push(`A ${domain} → ${expected.ipv4 ?? "(server-IP)"}`);
  if (expected.ipv6 && !apexHasIpv6) missing.push(`AAAA ${domain} → ${expected.ipv6}`);

  if (includeWww) {
    const wwwHasIpv4 = expected.ipv4 ? wwwA.includes(expected.ipv4) : wwwA.length > 0;
    if (!wwwHasIpv4) missing.push(`A www.${domain} → ${expected.ipv4 ?? "(server-IP)"}`);
  }

  return {
    ok: missing.length === 0,
    expected,
    resolved: { a, aaaa, wwwA, wwwAaaa },
    missing,
  };
}

export function isValidDomain(domain: string): boolean {
  return /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain) && !domain.includes("..") && domain.length <= 253;
}
