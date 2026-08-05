import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadSigningKeyFromEnv, MandateKeyUnavailableError } from "@/lib/mandate/mandate";
import { STATUS_LIST_CAPACITY } from "@/lib/mandate/statusIndex";
import { signStatusList } from "@/lib/mandate/statusList";
import { reportError } from "@/lib/report-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How long a cached copy stays authoritative. */
const TTL_SECONDS = 900;

/**
 * The signed revocation list.
 *
 * This is what makes the per-mandate status endpoint optional rather than
 * load-bearing. An institution fetches this every fifteen minutes, verifies our
 * signature once, and then answers "is this revoked" offline in a single bit
 * lookup — at any volume, and without telling us which mandate it asked about.
 *
 * Removing that live dependency is what makes the mandate acceptable to a risk
 * team, and removing the query trail is what stops us accumulating a
 * surveillance capability over who checked what.
 */
export async function GET() {
  try {
    const key = loadSigningKeyFromEnv();
    // Never `take: N` by row count — that truncates arbitrary revocations.
    // Capacity is an index bound; refuse to publish if any bit is out of range.
    const revoked = await prisma.mandateRevocation.findMany({
      select: { statusIndex: true },
      where: { statusIndex: { not: null } },
    });
    const indices = revoked.map((r) => r.statusIndex as number);
    if (indices.some((idx) => idx < 0 || idx >= STATUS_LIST_CAPACITY)) {
      return NextResponse.json(
        { error: "status_list_capacity", capacity: STATUS_LIST_CAPACITY },
        { status: 503 },
      );
    }

    const token = await signStatusList(
      {
        issuer: process.env.MANDATE_ISSUER ?? "https://zakai-3uxj.vercel.app",
        revokedIndices: indices,
        size: STATUS_LIST_CAPACITY,
        ttlSeconds: TTL_SECONDS,
      },
      key,
    );

    return new NextResponse(token, {
      headers: {
        "Content-Type": "application/statuslist+jwt",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": `public, max-age=${TTL_SECONDS}, stale-while-revalidate=60`,
      },
    });
  } catch (err) {
    if (err instanceof MandateKeyUnavailableError) {
      // Never serve an unsigned or self-signed list: a consumer that cannot
      // verify the signature would either reject it (fine) or trust it (fatal).
      return NextResponse.json({ error: "signing_key_unavailable" }, { status: 503 });
    }
    await reportError(err, { route: "mandate/revocations" });
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
