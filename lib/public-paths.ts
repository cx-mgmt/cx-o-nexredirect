const PUBLIC_PREFIXES = ["/login", "/forgot", "/reset", "/setup", "/api/auth", "/api/setup", "/api/v1", "/r"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}
