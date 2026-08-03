import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=120",
};

/**
 * Public roster of admitted delegated issuers (no keys).
 * Full issuers with their own JWKS remain in the trust registry.
 */
export async function GET() {
  const rows = await prisma.delegatedIssuer
    .findMany({
      where: { status: "active" },
      orderBy: { createdAt: "asc" },
      select: {
        slug: true,
        name: true,
        allowedScopes: true,
        createdAt: true,
        lastUsedAt: true,
      },
    })
    .catch(() => []);

  return NextResponse.json(
    {
      ok: true,
      count: rows.length,
      issuers: rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        allowed_scopes: r.allowedScopes,
        admitted_at: r.createdAt.toISOString(),
        last_used_at: r.lastUsedAt?.toISOString() ?? null,
        issue_endpoint: "POST /api/mandate/issue",
        on_behalf_of_claim: "zkm.onBehalfOf",
        apply: "POST /api/mandate/delegation/apply",
      })),
      disclaimer:
        "Delegated issuers sign via Zakai keys; verify zkm.onBehalfOf on claims. Not listed in JWKS issuers array.",
    },
    { headers: CORS },
  );
}
