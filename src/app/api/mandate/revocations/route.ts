import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadSigningKeyFromEnv, MandateKeyUnavailableError } from "@/lib/mandate/mandate";
import { signStatusList } from "@/lib/mandate/statusList";
import { reportError } from "@/lib/report-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How long a cached copy stays authoritative. */
const TTL_SECONDS = 900;
/** Bitstring capacity. Cheap to oversize; expensive to run out of. */
const LIST_SIZE = 1_000_000;

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
    const revoked = await prisma.mandateRevocation.findMany({
      select: { statusIndex: true },
      where: { statusIndex: { not: null } },
      take: LIST_SIZE,
    });

    const token = await signStatusList(
      {
        issuer: process.env.MANDATE_ISSUER ?? "https://zakai-3uxj.vercel.app",
        revokedIndices: revoked.map((r) => r.statusIndex as number),
        size: LIST_SIZE,
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
