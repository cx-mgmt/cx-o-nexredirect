const DEV_FALLBACK = "nexredirect-dev-secret-please-change";

function allowDevFallback(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  // next build importiert die Module, ohne dass ein Laufzeit-Geheimnis existiert.
  if (process.env.NEXT_PHASE === "phase-production-build") return true;
  if (process.env.npm_lifecycle_event === "build") return true;
  return false;
}

export function authSecret(): string {
  // Dynamischer Zugriff, damit der Wert nicht beim next build leer eingebacken wird.
  const fromEnv = process.env["NEXTAUTH_SECRET"]?.trim() || "";
  if (fromEnv && fromEnv !== DEV_FALLBACK && fromEnv.length >= 32) return fromEnv;
  if (allowDevFallback()) return fromEnv || DEV_FALLBACK;
  throw new Error(
    "NEXTAUTH_SECRET fehlt oder ist der oeffentliche Dev-Wert. In Produktion muss ein eigenes Geheimnis mit mindestens 32 Zeichen gesetzt sein."
  );
}
