import { NextResponse } from "next/server";
import { requireUserId, badRequest } from "@/lib/api";
import {
  issueTrackRecordCredential,
  TrackRecordUnavailableError,
} from "@/lib/mandate/trackRecordCredential";
import { MandateKeyUnavailableError } from "@/lib/mandate/mandate";
import { reportError } from "@/lib/report-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Issue the caller's own signed track-record credential — never anyone
 * else's; there is no lookup-by-id here on purpose. See
 * src/lib/mandate/trackRecordCredential.ts for what this is and isn't.
 */
export async function GET(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const origin = new URL(request.url).origin;
  const issuer =
    process.env.MANDATE_ISSUER?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || origin;

  try {
    const { token, stats } = await issueTrackRecordCredential(auth.userId, issuer);
    return NextResponse.json({
      ok: true,
      credential: token,
      stats,
      verify: {
        jwks: `${origin}/.well-known/zakai-jwks.json`,
        typ: "zakai-track-record+jwt",
        verify_uri: `${origin}/api/authority/track-record/verify`,
      },
    });
  } catch (err) {
    if (err instanceof TrackRecordUnavailableError) {
      const status = err.code === "no_history" ? 404 : 503;
      return badRequest(err.code, status);
    }
    if (err instanceof MandateKeyUnavailableError) {
      return badRequest("signing_unavailable", 503);
    }
    await reportError(err, { route: "authority-track-record" });
    return badRequest("genericError", 500);
  }
}
