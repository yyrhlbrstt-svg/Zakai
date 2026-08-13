import { CATALOG } from "@/lib/priority";

/**
 * Why this sign-in screen exists, said in the reader's own terms.
 *
 * WHAT WENT WRONG
 *
 * `/check` is one of the three pinned "most worth doing now" actions on
 * `/money` and `/leaks` — and it is the only consumer door in the product
 * that hard-redirects a guest. Measured across thirty-five entry routes it is
 * the single exception. So the most-pushed action on the busiest screen ends,
 * for anybody without an account, at a bare form headed "כניסה": no reason,
 * no mention of what they had just tapped, and no sign that they were one
 * step into anything.
 *
 * The gate itself is right — `/api/cases/analyze` opens a real Case, and a
 * Case without an owner is not a thing that can exist. What was wrong was
 * arriving somewhere else with no explanation.
 *
 * WHY IT READS FROM THE CATALOG
 *
 * Thirty-seven distinct paths pass `?return=`. A hand-written sentence per
 * path across six locales is a table that goes stale the first week nobody
 * updates it. `CATALOG` already names every one of these tools for a reader,
 * so the name comes from there and stays correct as the catalog grows.
 *
 * Returns null when the path is not a tool anybody would recognise by name
 * (`/dashboard`, `/activity`) — in which case the screen says nothing extra,
 * which is better than saying something empty.
 */
/**
 * The other half of the sign-in screen, carrying the errand with it.
 *
 * The switch between "log in" and "sign up" was a bare `/signup`. So the
 * journey was: tap "בדיקת חשבון סלולר" on /money → bounced to
 * /login?return=/check → "no account? sign up" → /signup with no return at
 * all → account created → dropped on the default page, with the thing you
 * came to do gone. The one link on that screen most likely to be tapped by
 * the person we most want to keep — somebody who has no account yet — was the
 * one that dropped their errand on the floor.
 */
export function authSwitchHref(mode: "login" | "signup", returnTo: string | null): string {
  const base = mode === "login" ? "/signup" : "/login";
  if (!returnTo) return base;
  return `${base}?return=${encodeURIComponent(returnTo)}`;
}

export function toolNameForReturnPath(
  path: string | null | undefined,
  locale: string,
): string | null {
  if (!path) return null;
  // Strip a query or hash: "/cancel?provider=hot" is still the cancel tool.
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "");
  if (!clean.startsWith("/")) return null;
  const hit = CATALOG.find((a) => a.href.split(/[?#]/)[0].replace(/\/+$/, "") === clean);
  if (!hit) return null;
  return locale === "he" ? hit.titleHe : hit.titleEn;
}
