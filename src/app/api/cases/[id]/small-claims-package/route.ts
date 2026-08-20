import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import {
  buildSmallClaimsPackage,
  SmallClaimsUnsupportedError,
} from "@/lib/smallClaimsPackage";
import { providerHebrewName } from "@/lib/providers";
import { DraftRightError } from "@/lib/rightsGraph/registry";

const schema = z.object({
  /** Charges observed after the cancellation notice, in shekels — user-supplied, never inferred. */
  chargedAfterShekels: z.number().min(0).max(500_000).optional(),
  claimantIdNumber: z.string().max(12).optional(),
  claimantAddress: z.string().max(200).optional(),
  companyAddress: z.string().max(200).optional(),
});

const dateLabel = (d: Date): string =>
  d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });

/**
 * Generate the small-claims package draft for a case — the last rung of the
 * escalation ladder the follow-up letters already name. Pure generation:
 * nothing is filed, nothing is stored, nothing is sent. The person reviews
 * the draft and files it themselves at the Judicial Authority.
 *
 * Preconditions enforced, not assumed:
 *  - §31א(ב) requires a prior written demand — a case with no written
 *    outreach at all gets a 409 naming exactly that, because generating a
 *    claim statement that asserts a demand which never existed would put a
 *    false statement in front of a court.
 *  - A demand still QUEUED (never dispatched) is included in the timeline as
 *    created-not-dispatched; the response flags when nothing was ever SENT.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("small-claims-package", auth.userId, 20, 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return badRequest("genericError");

  const kase = await prisma.case.findFirst({
    where: { id, userId: auth.userId },
    include: { user: { select: { name: true } } },
  });
  if (!kase) return badRequest("genericError", 404);

  const outbox = await prisma.outbox.findMany({
    where: { caseId: kase.id, channel: "EMAIL" },
    orderBy: { createdAt: "asc" },
    select: { subject: true, status: true, createdAt: true, sentAt: true },
  });
  if (outbox.length === 0) {
    return NextResponse.json(
      { error: "writtenDemandMissing" },
      { status: 409 },
    );
  }

  const timeline = outbox.map((row) => ({
    dateLabel: dateLabel(row.sentAt ?? row.createdAt),
    label:
      (row.subject?.trim() || "פנייה בכתב לספק") +
      (row.status === "SENT" && row.sentAt
        ? " (נשלחה)"
        : " (נוצרה במערכת וטרם שוגרה)"),
  }));

  const first = outbox[0];
  const anySent = outbox.some((row) => row.status === "SENT");

  try {
    const pkg = buildSmallClaimsPackage({
      vertical: kase.vertical,
      claimantName: kase.user?.name?.trim() || "",
      claimantIdNumber: parsed.data.claimantIdNumber,
      claimantAddress: parsed.data.claimantAddress,
      company: providerHebrewName(kase.provider),
      companyAddress: parsed.data.companyAddress,
      product: kase.planDescription.trim() || providerHebrewName(kase.provider),
      cancelNoticeDateLabel: dateLabel(first.sentAt ?? first.createdAt),
      chargedAfterAgorot:
        parsed.data.chargedAfterShekels !== undefined
          ? Math.round(parsed.data.chargedAfterShekels * 100)
          : undefined,
      timeline,
    });

    return NextResponse.json({
      package: pkg,
      // Honesty flag the UI must surface: if no demand ever left the system,
      // the 31א(ב) trail is not yet real outside Zakai.
      writtenDemandDispatched: anySent,
    });
  } catch (err) {
    if (err instanceof SmallClaimsUnsupportedError) {
      return NextResponse.json({ error: "verticalUnsupported" }, { status: 409 });
    }
    if (err instanceof DraftRightError) {
      return NextResponse.json({ error: "rightNotVerified" }, { status: 409 });
    }
    throw err;
  }
}
