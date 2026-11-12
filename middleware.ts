import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { authSecret } from "./lib/auth-secret";
import { isPublicPath } from "./lib/public-paths";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: authSecret() });
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
