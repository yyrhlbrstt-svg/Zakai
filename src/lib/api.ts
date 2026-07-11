import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";

/** Resolve the session user id in a route handler, or return a 401 response. */
export async function requireUserId(): Promise<
  { userId: string } | { response: NextResponse }
> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { response: NextResponse.json({ error: "mustLogin" }, { status: 401 }) };
  }
  return { userId };
}

export function badRequest(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}
