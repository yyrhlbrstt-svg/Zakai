import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest } from "@/lib/api";
import { getSessionUserId } from "@/lib/auth/session";
import { aiAvailable, extractStatementImage, AiUnavailableError } from "@/lib/ai";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";

const ALLOWED_MEDIA = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);

/**
 * Matches MAX_UPLOAD_IMAGE_BYTES (3MB raw) on the client, plus base64/JSON
 * overhead — was 5.5M, which is silently unreachable in production: Vercel's
 * ~4.5MB serverless request-body ceiling rejects anything that large before
 * this validation ever runs.
 */
const MAX_BASE64_CHARS = 4_200_000;

const schema = z.object({
  imageBase64: z.string().min(10).max(MAX_BASE64_CHARS),
  mediaType: z.string().default("image/jpeg"),
});

/**
 * Free scans for someone with no account, per day, per IP.
 *
 * Photographing a bill is the product's front door, and it used to open only
 * for people who had already signed up — so a first-time visitor uploaded
 * their bill, got a 401, and reasonably concluded the thing does not work.
 * An account is genuinely needed to OPEN A CASE (it is their claim, their
 * mailbox, their money); it is not needed to read a photo back to them.
 *
 * Each anonymous scan costs one vision call, so the allowance is small and
 * keyed to the IP with the spoofing-resistant helper. Set the env var to 0 to
 * close the door again if the bill ever gets uncomfortable.
 */
const DEFAULT_ANON_SCAN_LIMIT = 3;

function anonScanLimit(): number {
  const raw = Number(process.env.ANON_SCAN_DAILY_LIMIT);
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_ANON_SCAN_LIMIT;
  return Math.floor(raw);
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();

  if (!aiAvailable()) return badRequest("aiUnavailable", 503);

  if (userId) {
    const limited = await rateLimit("scan-extract", userId, 20, 24 * 3600);
    if (!limited.ok) {
      return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });
    }
  } else {
    const allowance = anonScanLimit();
    if (allowance <= 0) {
      return NextResponse.json({ error: "mustLogin" }, { status: 401 });
    }
    const limited = await rateLimit(
      "scan-extract-anon",
      clientIp(request),
      allowance,
      24 * 3600,
    );
    if (!limited.ok) {
      // Not "broken" and not "forbidden": they used the free reads. The client
      // turns this into a sign-in card, which is a true statement of what is
      // needed next rather than a wall on arrival.
      return NextResponse.json({ error: "mustLogin" }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  const mediaType = (parsed.data.mediaType || "image/jpeg").toLowerCase().split(";")[0].trim();
  if (!ALLOWED_MEDIA.has(mediaType)) {
    return badRequest("genericError");
  }

  try {
    const csv = await extractStatementImage(parsed.data.imageBase64, mediaType);
    /**
     * Read fine, and there was nothing in it. Distinguished from a failed read
     * because the two need opposite advice: "try a clearer photo" is useless
     * to someone who photographed a perfectly sharp picture of something that
     * was never a statement, and it was the only thing we said to them.
     */
    if (!csv.trim()) return badRequest("noTransactions", 422);
    return NextResponse.json({ csv });
  } catch (err) {
    if (err instanceof AiUnavailableError) return badRequest("aiUnavailable", 503);
    await reportError(err, { route: "scan-extract" });
    return badRequest("readError", 422);
  }
}
