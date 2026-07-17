import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiAvailable } from "@/lib/ai";

export const dynamic = "force-dynamic";

/**
 * Public self-diagnostic — lets anyone (read: the founder, on a phone)
 * verify the deployment's wiring in one glance, without exposing secrets:
 *  - db:  can the app reach the database?
 *  - ai:  is ANTHROPIC_API_KEY configured? (turns on bill-photo analysis,
 *         the assistant chat, and screenshot scanning)
 */
export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }

  return NextResponse.json({
    ok: db,
    db,
    ai: aiAvailable(),
    time: new Date().toISOString(),
  });
}
