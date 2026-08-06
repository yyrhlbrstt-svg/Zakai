import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "./session";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  phone: string;
  plan: string;
  referralCode: string;
  /** Null until the person proved they control the address. */
  emailVerifiedAt: Date | null;
};

/**
 * The logged-in user, or null. Safe fields only.
 *
 * Called unconditionally from the root `[locale]/layout.tsx` — every route in
 * the app, public marketing pages included, renders through this — and again,
 * separately, from most individual pages and several nested components (see
 * grep for `getCurrentUser()`). Without request memoization that was the same
 * `prisma.user.findUnique` running 2-5 times per page load, sequentially,
 * for identical data; `cache()` collapses repeat calls within one render into
 * a single query, same as `fetch` request deduping. A DB blip still degrades
 * to "treat this request as logged out" rather than take down the entire
 * site for anyone still carrying a session cookie.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;
  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        plan: true,
        referralCode: true,
        emailVerifiedAt: true,
      },
    });
  } catch {
    return null;
  }
});

/** Throws (used by route handlers / actions) if not logged in. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}
