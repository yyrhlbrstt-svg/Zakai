import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";
import { buildAccountExport } from "@/lib/services/accountExport";
import { logSecurityEvent } from "@/lib/security/securityEvent";

export const dynamic = "force-dynamic";

/**
 * Download everything we hold about this account.
 *
 * Rate limited because it is the single most expensive read in the product and
 * the single most attractive one to anybody who has just stolen a session — a
 * few per hour is generous for a person and useless for a scraper.
 */
export async function GET(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("account-export", auth.userId, 5, 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  try {
    const data = await buildAccountExport(auth.userId);
    if (!data) return NextResponse.json({ error: "notFound" }, { status: 404 });

    // A whole account leaving in one file is the most valuable thing a stolen
    // session can take. The rate limit bounds how often; this records that it
    // happened at all, which is the part the owner would want afterwards.
    await logSecurityEvent({
      type: "account_exported",
      userId: auth.userId,
      ip: clientIp(request),
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="zakai-account-${stamp}.json"`,
        // A file containing someone's whole account must not sit in a shared
        // cache, and must not be re-served from a proxy after they log out.
        "Cache-Control": "no-store, private",
      },
    });
  } catch (err) {
    await reportError(err, { route: "account-export" });
    return NextResponse.json({ error: "genericError" }, { status: 500 });
  }
}
