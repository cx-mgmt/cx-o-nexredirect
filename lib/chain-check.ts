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
      const res = await fetch(current, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(8_000),
        headers: { "User-Agent": "corex-nexredirect/chain-check" },
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) break;
        try {
          current = new URL(location, current).href;
        } catch {
          break;
        }
        hops++;
      } else {
        break;
      }
    }
  } catch (e) {
    return {
      is_chain: hops > 0,
      hops,
      final_url: hops > 0 ? current : undefined,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  return { is_chain: hops > 0, hops, final_url: hops > 0 ? current : undefined };
}
