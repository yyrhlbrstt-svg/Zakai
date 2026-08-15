import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { agorotToShekels } from "@/lib/money";
import {
  CommitmentError,
  activeCommitments,
  addCommitment,
  reviewCommitments,
} from "@/lib/services/commitments";

/**
 * The record of what a person is committed to.
 *
 * Recovering money is episodic — it happens when somebody suspects, on a
 * particular day, that they are owed something. Obligations are continuous:
 * the set changes every month whether or not anyone is looking, and until now
 * it lived nowhere.
 */
const schema = z.object({
  label: z.string().trim().min(1).max(120),
  counterparty: z.string().trim().max(80).optional(),
  category: z.string().trim().max(40).optional(),
  /** Null is a real answer — "we do not know what this costs yet". */
  monthlyShekels: z.number().min(0).max(1_000_000).nullable().optional(),
  renewsOn: z.string().max(32).optional(),
  noticeDays: z.number().int().min(0).max(1095).nullable().optional(),
  source: z.enum(["contract_scan", "statement_scan", "manual"]).optional(),
});

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  // An unparseable date becomes no date rather than today: "today" would make
  // the notice window instantly missed and tell somebody they had lost a
  // deadline that has not arrived.
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  try {
    const created = await addCommitment(auth.userId, {
      label: parsed.data.label,
      counterparty: parsed.data.counterparty,
      category: parsed.data.category as never,
      monthlyShekels: parsed.data.monthlyShekels ?? null,
      renewsOn: parseDate(parsed.data.renewsOn),
      noticeDays: parsed.data.noticeDays ?? null,
      source: parsed.data.source,
    });
    return NextResponse.json({
      ok: true,
      id: created.id,
      actBy: created.window.actBy?.toISOString().slice(0, 10) ?? null,
      state: created.window.state,
      daysLeft: created.window.daysLeft,
    });
  } catch (err) {
    if (err instanceof CommitmentError) return badRequest(err.code, 400);
    throw err;
  }
}

export async function GET() {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const [items, review] = await Promise.all([
    activeCommitments(auth.userId),
    reviewCommitments(auth.userId),
  ]);

  return NextResponse.json({
    ok: true,
    commitments: items.map((c) => ({
      id: c.id,
      label: c.label,
      counterparty: c.counterparty,
      category: c.category,
      monthlyShekels: c.monthlyMinor === null ? null : agorotToShekels(c.monthlyMinor),
      renewsOn: c.renewsOn?.toISOString().slice(0, 10) ?? null,
      noticeDays: c.noticeDays,
      actBy: c.window.actBy?.toISOString().slice(0, 10) ?? null,
      state: c.window.state,
      daysLeft: c.window.daysLeft,
    })),
    review: {
      actingCount: review.acting.length,
      overlapCount: review.overlaps.length,
      monthlyTotalShekels: agorotToShekels(review.monthlyTotalMinor),
      // Said out loud rather than folded into the total: a contract nobody has
      // priced is not a free one, and a total that quietly omits it would
      // understate what this person is committed to.
      unpriced: review.unpriced,
      unknownDeadline: review.unknownDeadline,
    },
  });
}
