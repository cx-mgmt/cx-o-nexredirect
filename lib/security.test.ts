import assert from "node:assert/strict";
import test from "node:test";
import { authSecret } from "./auth-secret.ts";
import { clientIpFromPeer, sanitizeInboundHeaders } from "./client-ip.ts";
import { isPublicPath } from "./public-paths.ts";
import {
  assertOutboundUrl,
  buildRedirectLocation,
  isSafeRedirectTarget,
  safeContinuePath,
} from "./safe-url.ts";

test("oeffentliche Pfade sind eng begrenzt", () => {
  assert.equal(isPublicPath("/login"), true);
  assert.equal(isPublicPath("/forgot"), true);
  assert.equal(isPublicPath("/reset/abc"), true);
  assert.equal(isPublicPath("/api/auth/forgot"), true);
  assert.equal(isPublicPath("/api/v1/health"), true);
  assert.equal(isPublicPath("/r/token"), true);
  assert.equal(isPublicPath("/dashboard"), false);
  assert.equal(isPublicPath("/login-extra"), false);
  assert.equal(isPublicPath("/registry"), false);
  assert.equal(isPublicPath("/api/settings"), false);
});

test("Redirect-Ziele nur http(s) ohne interne Adressen und ohne Zugangsdaten", () => {
  assert.equal(isSafeRedirectTarget("https://www.zielseite.de/pfad"), true);
  assert.equal(isSafeRedirectTarget("http://203.0.113.10/ok"), true);
  for (const bad of [
    "javascript:alert(1)",
    "data:text/html,hi",
    "file:///etc/passwd",
    "ftp://example.com/",
    "https://user:pass@evil.com/",
    "https://paypal.com@evil.com/",
    "http://127.0.0.1/",
    "http://2130706433/",
    "http://0x7f000001/",
    "http://0177.0.0.1/",
    "http://127.1/",
    "http://169.254.169.254/latest/meta-data",
    "http://10.0.0.5/",
    "http://192.168.1.1/",
    "http://[::1]/",
    "http://localhost/admin",
    "http://metadata.google.internal/",
    "//evil.com",
    "https://evil.com/\r\nSet-Cookie: a=b",
  ]) {
    assert.equal(isSafeRedirectTarget(bad), false, bad);
  }
});

test("Pfad bleibt auf dem konfigurierten Host", () => {
  const base = {
    targetUrl: "https://gut.example/start",
    catchallUrl: null,
    preservePath: true,
    pathname: "/foo",
    path: "/foo?x=1",
  };
  assert.equal(buildRedirectLocation(base), "https://gut.example/start/foo?x=1");
  assert.equal(
    buildRedirectLocation({ ...base, path: "//evil.com", pathname: "//evil.com" }),
    "https://gut.example/start"
  );
  assert.equal(
    buildRedirectLocation({ ...base, preservePath: false, path: "/secret", pathname: "/secret" }),
    "https://gut.example/start"
  );
  assert.equal(
    buildRedirectLocation({
      targetUrl: "javascript:alert(1)",
      catchallUrl: null,
      preservePath: false,
      pathname: "/",
      path: "/",
    }),
    null
  );
});

test("Sunset-Link bleibt auf dem eigenen Pfad", () => {
  assert.equal(safeContinuePath("/seite"), "/seite?nr_continue=1");
  assert.equal(safeContinuePath("//evil.com"), "/?nr_continue=1");
  assert.equal(safeContinuePath("https://evil.com"), "/?nr_continue=1");
  assert.equal(safeContinuePath("/ok?a=1"), "/ok?a=1&nr_continue=1");
});

test("Client-IP vertraut X-Forwarded-For nur vom lokalen Proxy", () => {
  assert.equal(clientIpFromPeer("203.0.113.8", "127.0.0.1"), "203.0.113.8");
  assert.equal(clientIpFromPeer("127.0.0.1", "10.0.0.5, 203.0.113.9"), "203.0.113.9");
  assert.equal(clientIpFromPeer("::ffff:127.0.0.1", "198.51.100.4"), "198.51.100.4");
  const headers: Record<string, string> = {
    "x-forwarded-for": "127.0.0.1",
    "x-middleware-subrequest": "middleware",
  };
  const ip = sanitizeInboundHeaders(headers, "203.0.113.8");
  assert.equal(ip, "203.0.113.8");
  assert.equal(headers["x-forwarded-for"], "203.0.113.8");
  assert.equal(headers["x-middleware-subrequest"], undefined);
});

test("Produktion startet nicht mit dem oeffentlichen Dev-Geheimnis", () => {
  const prevNode = process.env.NODE_ENV;
  const prevSecret = process.env.NEXTAUTH_SECRET;
  const prevPhase = process.env.NEXT_PHASE;
  const prevLife = process.env.npm_lifecycle_event;
  process.env["NODE_ENV"] = "production";
  delete process.env.NEXT_PHASE;
  delete process.env.npm_lifecycle_event;
  process.env.NEXTAUTH_SECRET = "nexredirect-dev-secret-please-change";
  assert.throws(() => authSecret());
  process.env.NEXTAUTH_SECRET = "x".repeat(32);
  assert.equal(authSecret(), "x".repeat(32));
  if (prevNode === undefined) delete process.env.NODE_ENV;
  else process.env["NODE_ENV"] = prevNode;
  if (prevSecret === undefined) delete process.env.NEXTAUTH_SECRET;
  else process.env.NEXTAUTH_SECRET = prevSecret;
  if (prevPhase === undefined) delete process.env.NEXT_PHASE;
  else process.env.NEXT_PHASE = prevPhase;
  if (prevLife === undefined) delete process.env.npm_lifecycle_event;
  else process.env.npm_lifecycle_event = prevLife;
});

test("Outbound-Abrufe lehnen interne Ziele ab", async () => {
  assert.equal(await assertOutboundUrl("http://127.0.0.1/"), null);
  assert.equal(await assertOutboundUrl("http://169.254.169.254/latest/meta-data"), null);
  assert.equal(await assertOutboundUrl("javascript:alert(1)"), null);
  assert.equal(await assertOutboundUrl("https://user:pass@evil.com/hook"), null);
});
