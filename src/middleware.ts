import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

/**
 * Geo-aware locale routing. next-intl handles all locale-prefixed paths; we
 * only override the bare-root redirect ("/") to pick the language by the
 * visitor's country: Israel (or unknown) → Hebrew, everyone else → English.
 * Once a locale is in the URL, the user's explicit choice always wins.
 */
export default function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    const country = (
      request.headers.get("x-vercel-ip-country") ||
      request.headers.get("cf-ipcountry") ||
      ""
    ).toUpperCase();
    const target = country && country !== "IL" ? "/en" : "/he";
    return NextResponse.redirect(new URL(target, request.url));
  }
  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for API routes, Next internals, and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
