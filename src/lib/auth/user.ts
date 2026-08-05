import "server-only";
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
 * the app, public marketing pages included, renders through this. A DB blip
 * must degrade to "treat this request as logged out" rather than take down
 * the entire site for anyone still carrying a session cookie.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
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
}

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
