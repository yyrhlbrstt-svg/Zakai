import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { agorotToShekels } from "@/lib/money";
import { PromiseError, checkPromise } from "@/lib/services/promisedCredits";

/**
 * Record what actually landed on the statement.
 *
 * Zero is a legitimate and important answer — "we looked and nothing came" is
 * the finding the whole record exists to capture — so the schema accepts it
 * rather than treating it as a missing field.
 */
const schema = z.object({
  observedShekels: z.number().min(0).max(1_000_000),
});

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  try {
    const promise = await checkPromise(id, auth.userId, parsed.data.observedShekels);
    const verdict = promise.verdict!;
    return NextResponse.json({
      ok: true,
      state: verdict.state,
      promisedShekels: agorotToShekels(promise.promisedMinor),
      observedShekels: agorotToShekels(verdict.observedMinor),
      shortfallShekels: agorotToShekels(verdict.shortfallMinor),
      ageDays: verdict.ageDays,
    });
  } catch (err) {
    if (err instanceof PromiseError) {
      return badRequest(err.code, err.code === "NO_PROMISE" ? 404 : 409);
    }
    throw err;
  }
}
