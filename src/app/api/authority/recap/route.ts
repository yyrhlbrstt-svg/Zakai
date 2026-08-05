import { NextResponse } from "next/server";
import { requireUserId, badRequest } from "@/lib/api";
import { loadTrackRecordStats, TrackRecordUnavailableError } from "@/lib/mandate/trackRecordCredential";
import { reportError } from "@/lib/report-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight sibling of /api/authority/track-record: same real, verified
 * stats (loadTrackRecordStats), but no JWS signing — this is for the
 * shareable "recap" card, which has no reason to depend on
 * MANDATE_SIGNING_JWK being configured just to show a number on screen.
 */
export async function GET() {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  try {
    const stats = await loadTrackRecordStats(auth.userId);
    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    if (err instanceof TrackRecordUnavailableError) {
      return badRequest(err.code, 503);
    }
    await reportError(err, { route: "authority-recap" });
    return badRequest("genericError", 500);
  }
}
