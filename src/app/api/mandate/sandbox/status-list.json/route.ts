import { NextResponse } from "next/server";
import { signSandboxStatusList, SANDBOX_STATUS_LIST_SIZE } from "@/lib/mandate/sandbox";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * The sandbox's own signed status list — the demo companion to the `status`
 * pointer every sandbox mandate carries (see issueSandboxMandate).
 *
 * With no `revoke` param, every index reads as valid — the same "nothing
 * revoked yet" list a fresh integration sees in production. Pass
 * `?revoke=<idx>[,<idx>...]` (the `statusIndex` a sandbox mandate was issued
 * with) to get back a list where that mandate now reads as revoked — a real,
 * cryptographically verifiable statuslist+jwt, not a canned response. That
 * is what lets an integrator's own verifier be tested against genuine
 * revocation, not just told the feature exists.
 *
 * Stateless on purpose: nothing here is written to a database, and no other
 * caller can affect what you get back. This is a self-test fixture, not a
 * shared revocation ledger.
 */
export async function GET(req: Request) {
  const limited = await rateLimit("mandate-sandbox-statuslist", clientIp(req), 60, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: CORS });
  }

  const url = new URL(req.url);
  const raw = url.searchParams.get("revoke") ?? "";
  const revokedIndices: number[] = [];
  if (raw.trim()) {
    const parts = raw.split(",").slice(0, 32);
    for (const part of parts) {
      const idx = Number(part.trim());
      if (!Number.isInteger(idx) || idx < 0 || idx >= SANDBOX_STATUS_LIST_SIZE) {
        return NextResponse.json(
          {
            error: "invalid_index",
            detail: `revoke indices must be integers in [0, ${SANDBOX_STATUS_LIST_SIZE})`,
          },
          { status: 400, headers: CORS },
        );
      }
      revokedIndices.push(idx);
    }
  }

  const token = await signSandboxStatusList({ origin: url.origin, revokedIndices });

  return new NextResponse(token, {
    headers: {
      "Content-Type": "application/statuslist+jwt",
      "Cache-Control": "no-store",
      ...CORS,
    },
  });
}
