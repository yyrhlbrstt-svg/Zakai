import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId, badRequest } from "@/lib/api";
import { askZakai, aiAvailable } from "@/lib/ai";
import { planConfig } from "@/lib/plans";
import { rateLimit, refundRateLimit } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";
import { buildAssistantCasesSnapshot } from "@/lib/services/assistantContext";
import { ensureReplyEndsWithNextAction } from "@/lib/services/nextAction";

const ALLOWED_IMAGE_MEDIA = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
/** Same cap as /api/scan/extract — a phone screenshot, not a dump. */
const MAX_IMAGE_BASE64_CHARS = 5_500_000;

const schema = z
  .object({
    question: z.string().trim().max(1000).default(""),
    locale: z.string().default("he"),
    imageBase64: z.string().min(10).max(MAX_IMAGE_BASE64_CHARS).optional(),
    imageMediaType: z.string().optional(),
  })
  .refine((v) => v.question.length >= 2 || v.imageBase64, {
    message: "question or image required",
  });

const QUOTA: Record<string, number> = { FREE: 5, PRO: 100, MAX: 300 };
const WINDOW_SECONDS = 30 * 24 * 3600;

const NEGOTIATION_COACH = `
CLOSURE COACH (revenue = completed loops):
- Always obey NEXT_ACTION / NEXT_ACTION_HREF in the snapshot. End with that one link only — never a second CTA.
- Prefer written offers over phone-only deals so the saving can be documented.
- SENT + written result → /money?case=<id> Record saving (SavingsProof). No fee without this.
- SENT + silence → written follow-up with a short deadline (max ~4 rounds). Use NEGOTIATION_BRIEF when present.
- MULTI_CASE_RANK → attack #1 only (highest expected recovery). Do not start a second Case.
- PROPOSED_SAVING → one-tap record on /money?case=<id>. Never open a duplicate case.
- Pre-send Case → finish Mandate send on /money?case=<id> before any new vertical.
- No open Case → /money only (not a menu of tools).
- OPEN_LOOP → never suggest a new scan or vertical. Finish the ranked case.
- Match the on-screen next-action panel when present — never invent a second plan.
- After SavingsProof only: suggest share. Never celebrate unverified amounts.
- Never promise a specific outcome. Never invent savings numbers. Never "we'll call you".
`.trim();

function hrefFromSnapshot(snapshot: string): string | null {
  const marked = snapshot.match(/NEXT_ACTION_HREF:\s*(\S+)/);
  if (marked?.[1]) return marked[1];
  const fromLine = snapshot.match(
    /NEXT_ACTION:[^\n]*?(\/money(?:\?[^.\s]*)?)\b/,
  );
  return fromLine?.[1] ?? null;
}

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  if (!aiAvailable()) return badRequest("aiUnavailable", 503);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  let image: { base64: string; mediaType: string } | undefined;
  if (parsed.data.imageBase64) {
    const mediaType = (parsed.data.imageMediaType || "image/jpeg").toLowerCase().split(";")[0].trim();
    if (!ALLOWED_IMAGE_MEDIA.has(mediaType)) return badRequest("genericError");
    image = { base64: parsed.data.imageBase64, mediaType };
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { plan: true },
  });
  const plan = planConfig(user?.plan).id;

  const limited = await rateLimit("assistant", auth.userId, QUOTA[plan], WINDOW_SECONDS);
  if (!limited.ok) {
    return NextResponse.json({ error: "quotaExceeded", plan }, { status: 429 });
  }

  const snapshot = await buildAssistantCasesSnapshot(auth.userId);
  const casesSummary = `${snapshot}\n\n${NEGOTIATION_COACH}`;
  const href = hrefFromSnapshot(snapshot);

  const question =
    parsed.data.question || (image ? "(No question — read the attached image and respond.)" : "");

  try {
    const raw = await askZakai(
      question,
      {
        plan,
        casesSummary,
        locale: parsed.data.locale,
      },
      image,
    );
    const answer = href ? ensureReplyEndsWithNextAction(raw, href) : raw;
    return NextResponse.json({ answer });
  } catch (err) {
    await refundRateLimit("assistant", auth.userId, WINDOW_SECONDS);
    await reportError(err, { route: "assistant-ask" });
    return badRequest("aiUnavailable", 503);
  }
}
