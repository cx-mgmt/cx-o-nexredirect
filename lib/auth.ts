import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getDb, type UserRow } from "./db";
import { checkLimit } from "./rate-limit";

function ipFromReq(req: unknown): string {
  if (!req || typeof req !== "object") return "unknown";
  const headers = (req as { headers?: Record<string, string | string[] | undefined> }).headers || {};
  const xff = headers["x-forwarded-for"];
  const xffStr = Array.isArray(xff) ? xff[0] : xff;
  if (xffStr) return xffStr.split(",")[0].trim();
  const sock = (req as { socket?: { remoteAddress?: string } }).socket;
  return sock?.remoteAddress || "unknown";
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || "nexredirect-dev-secret-please-change",
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "E-Mail oder Benutzername", type: "text" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;
        const ip = ipFromReq(req);

        // Rate-limit: 8 attempts per IP per 5 minutes
        const ipLimit = checkLimit(`login:ip:${ip}`, 8, 5 * 60 * 1000);
        if (!ipLimit.allowed) {
          console.warn(`[auth] rate-limited login from ${ip} (retry in ${ipLimit.retryAfterSec}s)`);
          await new Promise((r) => setTimeout(r, 1500));
          return null;
        }

        const identifier = credentials.email.toLowerCase().trim();
        const idLimit = checkLimit(`login:id:${identifier}`, 5, 15 * 60 * 1000);
        if (!idLimit.allowed) {
          await new Promise((r) => setTimeout(r, 1500));
          return null;
        }

        // Match by email OR username. Fallback to email-only if migration hasn't run yet.
        const db = getDb();
        let user: UserRow | undefined;
        try {
          user = db
            .prepare("SELECT id, email, username, password_hash, role, created_at FROM users WHERE email = ? OR username = ? LIMIT 1")
            .get(identifier, identifier) as UserRow | undefined;
        } catch {
          // username column missing — self-heal and retry email-only
          try { db.exec("ALTER TABLE users ADD COLUMN username TEXT"); } catch {}
          try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL"); } catch {}
          user = db
            .prepare("SELECT id, email, password_hash, role, created_at FROM users WHERE email = ? LIMIT 1")
            .get(identifier) as UserRow | undefined;
          if (user) (user as UserRow).username = null;
        }

        if (!user) {
          await new Promise((r) => setTimeout(r, 200));
          return null;
        }
        const valid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!valid) return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.username || user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
