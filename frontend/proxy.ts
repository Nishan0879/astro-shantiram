import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    // The admin dashboard is English-only. Send visitors without a session to sign in;
    // the API still checks every request, this just saves a round trip.
    if (pathname !== "/admin/login" && !request.cookies.has("admin_token")) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }
  return intl(request);
}

export const config = {
  // Skip API routes, Next.js internals and files with an extension
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
