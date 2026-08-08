import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  analyzeAnyBillImage,
  classifyDocumentImage,
  generateRecommendation,
  aiAvailable,
  AiUnavailableError,
} from "@/lib/ai";
import { isDocumentKind, routeDocument } from "@/lib/documentRouter";
import { createCase, CaseError } from "@/lib/services/cases";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { PROVIDERS, isProviderKey, resolveProviderKey, providerHebrewName } from "@/lib/providers";
import { chooseStance } from "@/lib/strategy/store";
import { rateLimit } from "@/lib/ratelimit";
import { isSupportedMarket } from "@/lib/global/registry";
import { withFooter } from "@/lib/letterFooter";
import { footerLocaleForCountry } from "@/lib/caseDraft";
import { firstOutreachEmail } from "@/lib/outreachEmail";
import { resolveTelecomContactEmail } from "@/lib/telecomContacts";
import { openLoopConflictIfAny } from "@/lib/services/expressCaseOpen";
import { getRulePack } from "@/lib/verticals";

/**
 * Matches MAX_UPLOAD_IMAGE_BYTES (3MB raw) on the client, plus base64/JSON
 * overhead — was 5.5M, which is silently unreachable in production: Vercel's
 * ~4.5MB serverless request-body ceiling rejects anything that large before
 * this validation ever runs.
 */
/**
 * Bill vertical → rule pack, but only where a pack actually exists.
 *
 * The extractor names what it sees; the pack registry decides what we can act
 * on. Anything without a pack falls back to telecom, which is where every
 * case lived before any other bill could be read — a case with a vertical no
 * pack understands would open and then have no rules to run.
 */
const VERTICAL_TO_PACK: Record<string, string> = {
  telecom: "telecom",
  electricity: "electricity",
  arnona: "arnona",
  subscription: "subscription",
  insurance: "duplicate-insurance",
};

const MAX_IMAGE_B64 = 4_200_000;
const ALLOWED_MEDIA = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);

/**
 * Say what an image that is not a mobile bill actually was.
 *
 * The classify call is a second round-trip, so it runs only on the failure
 * path — the successful case is unchanged and no slower. If classification
 * itself fails for any reason, this falls back to exactly the old response,
 * because a worse error message is better than a 500.
 */
async function describeUnreadableImage(
  imageBase64: string,
  mediaType: string,
): Promise<{ error: string; documentKind?: string; href?: string | null; issuer?: string | null }> {
  try {
    const doc = await classifyDocumentImage(imageBase64, mediaType);
    // A genuinely unreadable photo still gets the photo advice — that message
    // is correct there, and only there.
    if (!doc.legible) return { error: "readError" };

    const kind = isDocumentKind(doc.kind) ? doc.kind : "unknown";
    const route = routeDocument(kind, "/check");
    if (!route.href || route.handledHere) {
      return { error: route.messageKey, documentKind: kind, issuer: doc.issuer };
    }
    return {
      error: route.messageKey,
      documentKind: kind,
      href: route.href,
      issuer: doc.issuer,
    };
  } catch {
    return { error: "readError" };
  }
}

const schema = z.union([
  z.object({
    mode: z.literal("image"),
    imageBase64: z.string().min(10).max(MAX_IMAGE_B64),
    mediaType: z.string().default("image/jpeg"),
    beneficiary: z.string().max(40).optional(),
    locale: z.string().default("he"),
    providerContactEmail: z.string().max(120).optional(),
  }),
  z.object({
    mode: z.literal("manual"),
    provider: z.string().min(1),
    amountShekels: z.number().positive().max(100000),
    plan: z.string().default(""),
    beneficiary: z.string().max(40).optional(),
    locale: z.string().default("he"),
    providerContactEmail: z.string().max(120).optional(),
  }),
]);

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const openLoopRes = await openLoopConflictIfAny(auth.userId);
  if (openLoopRes) return openLoopRes;

  const limited = await rateLimit("cases-analyze", auth.userId, 40, 24 * 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const data = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return badRequest("mustLogin", 401);

  const activeCount = await prisma.case.count({
    where: { userId: auth.userId, status: { in: [...ACTIVE_CASE_STATUSES] } },
  });
  if (!canOpenCase(user.plan, activeCount)) return badRequest("caseLimit", 403);

  let providerKey: string;
  let amountShekels: number;
  let plan: string;
  /**
   * Which rule pack the bill belongs to, read from the bill itself. Defaults
   * to telecom, which is what every case was before any other bill could be
   * read at all — so a manual entry behaves exactly as it always has.
   */
  let billVertical: string = "telecom";

  if (data.mode === "image") {
    if (!aiAvailable()) {
      console.warn(
        "[analyze] image OCR unavailable: ANTHROPIC_API_KEY is not set in this environment.",
      );
      return badRequest("aiUnavailable", 503);
    }
    const mediaType = (data.mediaType || "image/jpeg").toLowerCase().split(";")[0].trim();
    if (!ALLOWED_MEDIA.has(mediaType)) return badRequest("genericError");
    try {
      /**
       * Read the bill, whatever bill it is.
       *
       * This used to try a mobile-only extractor and, when the photo was some
       * other kind of bill, work out the document type and send the reader to
       * a different page to start over. The bill was right there and readable,
       * and we answered it with directions — a consolation prize dressed as a
       * feature. A person who uploads a bill wants the bill handled.
       */
      const analysis = await analyzeAnyBillImage(data.imageBase64, mediaType);
      if (!analysis.readable) {
        // Genuinely unreadable now means genuinely unreadable: the extractor
        // above accepts every bill type, so this is a photo problem rather
        // than a scope problem, and the camera advice is finally correct.
        return NextResponse.json(await describeUnreadableImage(data.imageBase64, mediaType), {
          status: 422,
        });
      }
      providerKey = analysis.provider;
      amountShekels = analysis.amountShekels;
      plan = analysis.period;
      billVertical = analysis.vertical;
    } catch (err) {
      if (err instanceof AiUnavailableError) return badRequest("aiUnavailable", 503);
      return badRequest("readError", 422);
    }
  } else {
    providerKey = isProviderKey(data.provider) ? data.provider : resolveProviderKey(data.provider);
    amountShekels = data.amountShekels;
    plan = data.plan;
  }

  const providerLabelKey = PROVIDERS[providerKey as keyof typeof PROVIDERS]?.labelKey ?? "other";
  const market = isSupportedMarket(user.country) ? user.country.toUpperCase() : "IL";

  // Read from the bill when a pack exists for it, so the stance and the rules
  // match the document rather than assuming every bill is a phone bill.
  const vertical =
    getRulePack(VERTICAL_TO_PACK[billVertical] ?? "") ? VERTICAL_TO_PACK[billVertical] : "telecom";

  const stance = await chooseStance({
    market,
    vertical,
    counterparty: providerKey,
  });

  const rec = await generateRecommendation({
    providerLabel: providerHebrewName(providerKey),
    amountShekels,
    plan,
    locale: data.locale,
    customerName: user.name,
    stance: stance.instructions,
  });

  const outreachTo =
    firstOutreachEmail(data.providerContactEmail) ?? resolveTelecomContactEmail(providerKey);

  let kase;
  try {
    kase = await createCase({
      userId: auth.userId,
      provider: providerKey,
      amountShekels,
      plan,
      strategy: rec.strategy,
      targetShekels: rec.targetShekels,
      marketLowShekels: rec.marketLowShekels,
      marketHighShekels: rec.marketHighShekels,
      draftMessage: withFooter(
        rec.draftMessage,
        footerLocaleForCountry(user.country),
      ),
      beneficiaryLabel: data.beneficiary,
      strategyVariant: stance.variantId,
      strategySeed: stance.seed,
      // Carried from draft time to settle time alongside the stance, so the
      // outcome graph can later say which model actually got paid.
      drafterId: rec.drafterId,
      vertical,
      counterpartyEmail: outreachTo ?? undefined,
    });
  } catch (err) {
    if (err instanceof CaseError && err.message === "CASE_LIMIT") {
      return badRequest("caseLimit", 403);
    }
    throw err;
  }

  return NextResponse.json({
    caseId: kase.id,
    provider: providerKey,
    providerLabelKey,
    amountShekels,
    plan,
    strategy: rec.strategy,
    targetShekels: rec.targetShekels,
    marketLowShekels: rec.marketLowShekels,
    marketHighShekels: rec.marketHighShekels,
    draftMessage: rec.draftMessage,
    source: rec.source,
    needsOutreachEmail: !outreachTo,
  });
}
