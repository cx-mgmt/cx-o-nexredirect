import { getSetting } from "./db";

export async function fireWebhook(event: string, payload: Record<string, unknown>): Promise<void> {
  const url = getSetting("webhook_url");
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "corex-nexredirect" },
      body: JSON.stringify({ event, ts: Date.now(), payload }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.error("[webhook] failed", e);
  }
}
