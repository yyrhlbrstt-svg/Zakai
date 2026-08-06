import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { aiAvailable, analyzeReceiptImage, AiUnavailableError } from "@/lib/ai";
import { recordReceipt } from "@/lib/services/receipts";
import { rateLimit } from "@/lib/ratelimit";
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

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  if (!aiAvailable()) return badRequest("aiUnavailable", 503);

  const limited = await rateLimit("receipts-scan", auth.userId, 40, 24 * 3600);
  if (!limited.ok) {
    return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  const mediaType = (parsed.data.mediaType || "image/jpeg").toLowerCase().split(";")[0].trim();
  if (!ALLOWED_MEDIA.has(mediaType)) {
    return badRequest("genericError");
  }

  try {
    const analysis = await analyzeReceiptImage(parsed.data.imageBase64, mediaType);
    if (!analysis.readable) {
      return NextResponse.json({ readable: false });
    }
    const receipt = await recordReceipt(auth.userId, analysis, "photo");
    return NextResponse.json({ readable: true, receipt });
  } catch (err) {
    if (err instanceof AiUnavailableError) return badRequest("aiUnavailable", 503);
    await reportError(err, { route: "receipts-scan" });
    return badRequest("readError", 422);
  }
}
