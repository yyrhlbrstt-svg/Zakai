import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { partnerRefFromSearchParams } from "./lib/partnerAttribution";
import {
  MARKET_COOKIE,
  MARKET_COOKIE_MAX_AGE_SEC,
  marketFromGeoCountry,
} from "./lib/global/marketGeo";

const intlMiddleware = createMiddleware(routing);

/**
 * A fresh, unguessable value per request, so the CSP below can allow this
 * request's own inline bootstrap scripts (the pre-paint splash/`.js`-class
 * scripts in `[locale]/layout.tsx`) by name without opening the door to an
 * injected `<script>` tag from anywhere else — the actual point of a CSP.
 */
function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Script injection is the dangerous half of XSS (arbitrary code execution);
 * inline `style` attributes are pervasive throughout this codebase (dynamic
 * badge colors, animation delays) and are a materially smaller attack
 * surface, so `style-src` stays permissive rather than requiring a
 * repo-wide rewrite to ship this. No external script/style/image/font host
 * is allowlisted because the app doesn't load any — third-party analytics
 * and tracking are deliberately absent (see the privacy policy).
 */
function cspHeader(nonce: string): string {
  const plausible = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
  const scriptExtra = plausible ? " https://plausible.io" : "";
  const connectExtra = plausible ? " https://plausible.io" : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${scriptExtra}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${connectExtra}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}

/** First-touch attribution window for a B2B embed click — see PARTNER_REF_COOKIE below. */
const PARTNER_REF_COOKIE = "zakai_partner_ref";
const PARTNER_REF_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Every embed.js click (public/embed.js) lands on a page like
 * /he/money?utm_source=embed&utm_campaign=<partner-ref> — but a visitor
 * rarely signs up on that exact page, and nothing was ever carrying the ref
 * forward to the eventual /signup. The result: the entire "Partners · Embed"
 * channel marketed on /business and /partners had zero attribution behind
 * it — no way to answer "did this partner send us anyone," let alone bill a
 * referral fee on it. This is the fix: capture it once per visit into a
 * cookie, first-touch (never overwritten), and api/auth/signup reads it.
 *
 * `utm_source=agent` is the same channel for third-party AI assistants: the
 * handoff convention published in /llms.txt tells an agent to link its user
 * here with utm_campaign=agent-<name>, so the day an assistant starts sending
 * people, the founder can see it in the same partnerRef column instead of
 * wondering where the signups came from.
 *
 * Paid/social: utm_source=cpc|paid|social|partner + utm_campaign, or ?pref=
 * on short campaign links (/go/cancel?pref=...). Do not use ?ref= for
 * campaigns — /signup?ref= is the consumer referral code.
 */
function capturePartnerRef(request: NextRequest, res: NextResponse): void {
  if (request.cookies.get(PARTNER_REF_COOKIE)) return; // first-touch wins
  const ref = partnerRefFromSearchParams(request.nextUrl.searchParams);
  if (!ref) return;
  res.cookies.set(PARTNER_REF_COOKIE, ref, {
    maxAge: PARTNER_REF_MAX_AGE_SECONDS,
    sameSite: "lax",
    path: "/",
  });
}

function geoCountry(request: NextRequest): string {
  return (
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    ""
  ).toUpperCase();
}

/** First visit: remember inferred market for rights catalog + checker defaults. */
function ensureMarketCookie(request: NextRequest, res: NextResponse): void {
  if (request.cookies.get(MARKET_COOKIE)) return;
  const market = marketFromGeoCountry(geoCountry(request) || null);
  res.cookies.set(MARKET_COOKIE, market, {
    maxAge: MARKET_COOKIE_MAX_AGE_SEC,
    sameSite: "lax",
    path: "/",
  });
}

/**
 * Geo-aware locale routing. next-intl handles all locale-prefixed paths; we
 * only override the bare-root redirect ("/") to pick the language by the
 * visitor's country: Israel (or unknown) → Hebrew, everyone else → English.
 * Once a locale is in the URL, the user's explicit choice always wins.
 */
export default function middleware(request: NextRequest) {
  const nonce = makeNonce();
  const policy = cspHeader(nonce);
  // Mutating the incoming request's headers (rather than only the outgoing
  // response's) is what makes the nonce visible to `headers()` in the Server
  // Component that ends up rendering — next-intl's own `NextResponse.next()`/
  // `rewrite()` calls below carry this same request forward.
  request.headers.set("x-nonce", nonce);

  if (request.nextUrl.pathname === "/") {
    const country = geoCountry(request);
    const target = country && country !== "IL" ? "/en" : "/he";
    const res = NextResponse.redirect(new URL(target, request.url));
    res.headers.set("Content-Security-Policy", policy);
    capturePartnerRef(request, res);
    ensureMarketCookie(request, res);
    return res;
  }

  const res = intlMiddleware(request);
  res.headers.set("Content-Security-Policy", policy);
  res.headers.set("x-nonce", nonce);
  capturePartnerRef(request, res);
  ensureMarketCookie(request, res);
  return res;
}

export const config = {
  // Match all pathnames except for API routes, Next internals, and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
