import { getSetting } from "./db";
import { assertOutboundUrl } from "./safe-url";

export async function fireWebhook(event: string, payload: Record<string, unknown>): Promise<void> {
  const url = getSetting("webhook_url");
  if (!url) return;
  const safe = await assertOutboundUrl(url);
  if (!safe) {
    console.error("[webhook] rejected non-public url");
    return;
  }
  try {
    await fetch(safe, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json", "User-Agent": "corex-nexredirect" },
      body: JSON.stringify({ event, ts: Date.now(), payload }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.error("[webhook] failed", e);
  }
}
