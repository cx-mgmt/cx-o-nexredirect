import crypto from "crypto";

export type PasswordCheck = { ok: true } | { ok: false; reason: string };

const COMMON = new Set([
  "password", "passwort", "12345678", "123456789", "1234567890",
  "qwertz123", "qwerty123", "admin1234", "password1", "welcome123",
  "letmein123", "iloveyou1", "test1234", "changeme123",
]);

export async function validatePassword(pwd: string, opts: { checkPwned?: boolean } = {}): Promise<PasswordCheck> {
  if (typeof pwd !== "string") return { ok: false, reason: "Ungültig." };
  if (pwd.length < 10) return { ok: false, reason: "Mindestens 10 Zeichen." };
  if (pwd.length > 200) return { ok: false, reason: "Maximal 200 Zeichen." };
  if (!/[a-zA-Z]/.test(pwd)) return { ok: false, reason: "Mindestens 1 Buchstabe." };
  if (!/[0-9]/.test(pwd)) return { ok: false, reason: "Mindestens 1 Ziffer." };
  if (COMMON.has(pwd.toLowerCase())) return { ok: false, reason: "Zu trivial — eines der bekanntesten Passwörter." };

  if (opts.checkPwned !== false) {
    const pwned = await pwnedCount(pwd);
    if (pwned > 0) {
      return { ok: false, reason: `Passwort wurde in ${pwned.toLocaleString("de-DE")} bekannten Datenpannen gefunden — bitte ein anderes wählen.` };
    }
  }
  return { ok: true };
}

async function pwnedCount(pwd: string): Promise<number> {
  try {
    const sha = crypto.createHash("sha1").update(pwd).digest("hex").toUpperCase();
    const prefix = sha.slice(0, 5);
    const suffix = sha.slice(5);
    const r = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "nexredirect-password-check" },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return 0;
    const text = await r.text();
    for (const line of text.split("\n")) {
      const [hashSuffix, count] = line.trim().split(":");
      if (hashSuffix === suffix) return Number(count) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}
