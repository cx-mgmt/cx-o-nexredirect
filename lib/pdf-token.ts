import crypto from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET || "nexredirect-dev-secret-please-change";

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function createPdfToken(params: Record<string, string | number | boolean>, ttlSec = 60): string {
  const payload = JSON.stringify({ p: params, exp: Date.now() + ttlSec * 1000 });
  const b64 = Buffer.from(payload).toString("base64url");
  const sig = sign(b64);
  return `${b64}.${sig}`;
}

export function verifyPdfToken(token: string): Record<string, string> | null {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  if (sign(b64) !== sig) return null;
  try {
    const decoded = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as { p: Record<string, string>; exp: number };
    if (Date.now() > decoded.exp) return null;
    return decoded.p;
  } catch {
    return null;
  }
}
