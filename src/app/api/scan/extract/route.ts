import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { aiAvailable, extractStatementImage, AiUnavailableError } from "@/lib/ai";
import { rateLimit } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";

const schema = z.object({
  imageBase64: z.string().min(10),
  mediaType: z.string().default("image/jpeg"),
});

/**
 * Screenshot → CSV rows for the recurring-charges scan. The image is
 * processed transiently (never stored); the returned rows are analyzed
 * client-side by the same deterministic engine as pasted exports.
 */
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

  try {
    const csv = await extractStatementImage(parsed.data.imageBase64, parsed.data.mediaType);
    return NextResponse.json({ csv });
  } catch (err) {
    if (err instanceof AiUnavailableError) return badRequest("aiUnavailable", 503);
    await reportError(err, { route: "scan-extract" });
    return badRequest("readError", 422);
  }
}
