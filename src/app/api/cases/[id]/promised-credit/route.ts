import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { agorotToShekels } from "@/lib/money";
import { PromiseError, loadPromise, recordPromise } from "@/lib/services/promisedCredits";

/**
 * Record what the counterparty said they would credit — without claiming it
 * arrived. Writes no SavingsProof and raises no Fee, and the case stays open
 * at SENT until the money is actually observed.
 */
const schema = z.object({
  promisedShekels: z.number().positive().max(1_000_000),
  /** ISO date (yyyy-mm-dd) they gave. Omitted when they did not say. */
  dueBy: z.string().max(32).optional(),
  evidenceNote: z.string().max(500).optional(),
});

function parseDueBy(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  // An unparseable date is treated as no date rather than as today: "today"
  // would make the promise instantly overdue and chase a company that has
  // done nothing wrong yet.
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  try {
    const row = await recordPromise(id, auth.userId, {
      promisedShekels: parsed.data.promisedShekels,
      dueBy: parseDueBy(parsed.data.dueBy),
      evidenceNote: parsed.data.evidenceNote,
    });
    return NextResponse.json({
      ok: true,
      promisedShekels: agorotToShekels(row.promisedMinor),
      dueBy: row.dueBy?.toISOString() ?? null,
    });
  } catch (err) {
    if (err instanceof PromiseError) {
      return badRequest(err.code, err.code === "NOT_FOUND" ? 404 : 409);
    }
    throw err;
  }
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  const promise = await loadPromise(id, auth.userId);
  if (!promise) return NextResponse.json({ ok: true, promise: null });

  return NextResponse.json({
    ok: true,
    promise: {
      promisedShekels: agorotToShekels(promise.promisedMinor),
      promisedAt: promise.promisedAt.toISOString(),
      dueBy: promise.dueBy?.toISOString() ?? null,
      observedShekels:
        promise.observedMinor === null ? null : agorotToShekels(promise.observedMinor),
      dueForCheck: promise.dueForCheck,
      // Null until a statement was actually checked. An unchecked promise has
      // no verdict — reporting one would blame the counterparty for our own
      // inattention.
      state: promise.verdict?.state ?? null,
      shortfallShekels: promise.verdict ? agorotToShekels(promise.verdict.shortfallMinor) : null,
    },
  });
}
