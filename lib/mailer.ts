import { getSetting } from "./db";

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  secure: boolean;
};

export function getSmtpConfig(): SmtpConfig | null {
  const host = getSetting("smtp_host");
  if (!host) return null;
  return {
    host,
    port: Number(getSetting("smtp_port") || 587),
    user: getSetting("smtp_user") || "",
    password: getSetting("smtp_password") || "",
    from: getSetting("smtp_from") || getSetting("smtp_user") || "",
    secure: getSetting("smtp_secure") === "true",
  };
}

// HTML -> Plaintext fuer den Text-Teil der Mail. Kein Regex-"Tag-Filter"
// (der laesst sich umgehen): Tags werden iterativ entfernt, bis der String
// stabil ist, danach bleiben keine Winkelklammern uebrig.
function htmlToText(html: string): string {
  let text = html;
  let prev: string;
  do {
    prev = text;
    text = text.replace(/<[^<>]*>/g, " ");
  } while (text !== prev);
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/[<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function sendMail(opts: { to: string; subject: string; html: string; text?: string }): Promise<{ ok: boolean; error?: string }> {
  const cfg = getSmtpConfig();
  if (!cfg) return { ok: false, error: "smtp_not_configured" };
  try {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.default.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure || cfg.port === 465,
      auth: cfg.user ? { user: cfg.user, pass: cfg.password } : undefined,
    });
    await transport.sendMail({
      from: cfg.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? htmlToText(opts.html),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
