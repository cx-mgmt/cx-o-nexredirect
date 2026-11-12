import { assertOutboundUrl } from "./safe-url";

export type ChainResult = {
  is_chain: boolean;
  hops: number;
  final_url?: string;
  error?: string;
};

export async function checkRedirectChain(url: string): Promise<ChainResult> {
  let current = url;
  let hops = 0;
  const maxHops = 5;

  try {
    while (hops < maxHops) {
      const safe = await assertOutboundUrl(current);
      if (!safe) return { is_chain: hops > 0, hops, error: "target_rejected" };
      const res = await fetch(safe.toString(), {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(8_000),
        headers: { "User-Agent": "corex-nexredirect/chain-check" },
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) break;
        try {
          current = new URL(location, safe).href;
        } catch {
          break;
        }
        hops++;
      } else {
        break;
      }
    }
  } catch {
    return { is_chain: hops > 0, hops, error: "fetch_failed" };
  }

  return { is_chain: hops > 0, hops, final_url: hops > 0 ? current : undefined };
}
