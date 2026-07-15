import "server-only";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "./session";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  phone: string;
  plan: string;
};

/** The logged-in user, or null. Safe fields only. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, phone: true, plan: true },
  });
  return user;
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
