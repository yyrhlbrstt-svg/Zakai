import { NextResponse } from "next/server";
import { authorizationVectorsConformant } from "@/lib/referenceVerifier";
import { loadSigningKeyFromEnv, MandateKeyUnavailableError } from "@/lib/mandate/mandate";
import { verifyStatusListFromUrl } from "@/lib/mandate/statusList";
import { selfCheckStatusListBit } from "@/lib/mandate/statusListSelfCheck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=60",
};

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.MANDATE_ISSUER?.trim() ||
    "https://zakai-3uxj.vercel.app"
  ).replace(/\/$/, "");
}

/** Issuer claim on the signed status list — must match what revocations signs. */
function mandateIssuer(): string {
  return (process.env.MANDATE_ISSUER?.trim() || appOrigin()).replace(/\/$/, "");
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Machine readiness for institutions — same gate as Pioneer listing + status list.
 * GET → { ready, ready_for_pioneer, vectors, status_list, status_list_bit }.
 * Empty / false is honest. Bit self-check proves pack→sign→verify→isRevoked,
 * not merely that an empty signed JWT verifies.
 */
export async function GET() {
  const base = appOrigin();
  const issuer = mandateIssuer();
  const vectors = authorizationVectorsConformant();

  let statusList: { ok: boolean; detail: string } = { ok: false, detail: "unchecked" };
  try {
    await verifyStatusListFromUrl({
      statusListUri: `${base}/api/mandate/revocations`,
      issuer,
      jwksUri: `${base}/.well-known/zakai-jwks.json`,
    });
    statusList = { ok: true, detail: "verified_signed_statuslist_jwt" };
  } catch (err) {
    statusList = {
      ok: false,
      detail: err instanceof Error ? err.message : "status_list_failed",
    };
  }

  let statusListBit: { ok: boolean; detail: string } = { ok: false, detail: "unchecked" };
  try {
    const key = loadSigningKeyFromEnv();
    const bit = await selfCheckStatusListBit(key, issuer);
    statusListBit = bit.ok
      ? { ok: true, detail: "sign_verify_bit_flip" }
      : { ok: false, detail: bit.detail };
  } catch (err) {
    statusListBit = {
      ok: false,
      detail:
        err instanceof MandateKeyUnavailableError
          ? "signing_key_unavailable"
          : err instanceof Error
            ? err.message
            : "bit_check_failed",
    };
  }

  const ready = vectors.ok && statusList.ok && statusListBit.ok;
  return NextResponse.json(
    {
      ok: true,
      ready,
      ready_for_pioneer: ready,
      vectors: {
        passed: vectors.ok,
        total: vectors.total,
        failed: vectors.failed.slice(0, 3),
      },
      status_list: statusList,
      status_list_bit: statusListBit,
      next: ready
        ? `${base}/he/institutions/leader`
        : "Fix failures, then re-run. Client: npx zakai-mandate-ready",
      disclaimer:
        "Ready means machine conformance, not regulatory certification and not proof of production volume.",
    },
    { headers: CORS },
  );
}
