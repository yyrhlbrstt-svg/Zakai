import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { aiAvailable, extractStatementImage, AiUnavailableError } from "@/lib/ai";
import { rateLimit } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";

const ALLOWED_MEDIA = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);

/** ~4MB base64 ≈ 3MB binary — enough for a phone screenshot, not a dump. */
const MAX_BASE64_CHARS = 5_500_000;

const schema = z.object({
  imageBase64: z.string().min(10).max(MAX_BASE64_CHARS),
  mediaType: z.string().default("image/jpeg"),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  if (!aiAvailable()) return badRequest("aiUnavailable", 503);

  const limited = await rateLimit("scan-extract", auth.userId, 20, 24 * 3600);
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
    const csv = await extractStatementImage(parsed.data.imageBase64, mediaType);
    return NextResponse.json({ csv });
  } catch (err) {
    if (err instanceof AiUnavailableError) return badRequest("aiUnavailable", 503);
    await reportError(err, { route: "scan-extract" });
    return badRequest("readError", 422);
  }
}
