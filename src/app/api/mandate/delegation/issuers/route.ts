import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest } from "@/lib/api";
import { generateIssuerKey, hashIssuerKey } from "@/lib/mandate/delegation";
import { FORBIDDEN_SCOPES, isKnownScope, SCOPES } from "@/lib/mandate/scopes";
import { isForbiddenAnywhere } from "@/lib/mandate/domains";
import { secretsMatch } from "@/lib/security/timingSafe";

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

function adminOk(request: Request): boolean {
  const token = process.env.ZAKAI_ADMIN_TOKEN?.trim();
  if (!token) return false;
  const auth = request.headers.get("Authorization") || "";
  return secretsMatch(auth, `Bearer ${token}`);
}

const admitSchema = z.object({
  applicationId: z.string().trim().optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/, "slug must be lowercase alphanumeric with . or -"),
  name: z.string().trim().min(2).max(120),
  allowedScopes: z.array(z.string()).min(1).max(32),
});

/**
 * Admit a delegated issuer — the mechanical half of what delegation/apply.ts's
 * comment calls "stays manual, deliberately": the human decision to trust a
 * named third party is still made by a person reading the application, this
 * just replaces hand-writing an INSERT with a correctly-hashed key (easy to
 * get subtly wrong — wrong hash algorithm, forgotten allowedScopes, a status
 * that silently isn't "active") with the same generateIssuerKey/hashIssuerKey
 * pair the verifier itself uses, so the row this creates is provably
 * consistent with what checkDelegation and /api/mandate/issue expect.
 *
 * The key is returned exactly once, in this response, and never stored in
 * recoverable form — same guarantee as generateIssuerKey's own doc comment.
 */
export async function POST(request: Request) {
  if (!adminOk(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = admitSchema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const { applicationId, slug, name, allowedScopes } = parsed.data;

  const forbidden = allowedScopes.filter(
    (s) => isForbiddenAnywhere(s) || FORBIDDEN_SCOPES.includes(s),
  );
  if (forbidden.length > 0) {
    return NextResponse.json({ error: "scope_forbidden", scopes: forbidden }, { status: 400 });
  }
  const unknown = allowedScopes.filter((s) => !isKnownScope(s));
  if (unknown.length > 0) {
    return NextResponse.json(
      { error: "scope_unknown", scopes: unknown, known: SCOPES.map((s) => s.scope) },
      { status: 400 },
    );
  }

  const apiKey = generateIssuerKey();
  try {
    await prisma.delegatedIssuer.create({
      data: { slug, name, keyHash: hashIssuerKey(apiKey), allowedScopes, status: "active" },
    });
  } catch {
    // Unique constraint on slug/keyHash is the realistic failure here — a key
    // collision is cryptographically implausible, so this is almost always
    // "that slug is already admitted."
    return NextResponse.json({ error: "slug_taken" }, { status: 409 });
  }

  if (applicationId) {
    await prisma.delegationApplication
      .update({ where: { id: applicationId }, data: { status: "approved" } })
      .catch(() => {
        // The issuer row is already live; a failed status update on the
        // application is a bookkeeping miss, not a reason to fail the admission.
      });
  }

  return NextResponse.json({
    ok: true,
    slug,
    name,
    allowedScopes,
    api_key: apiKey,
    note: "Store this now — it is hashed at rest and cannot be recovered. Issue endpoint: POST /api/mandate/issue with header x-zakai-issue-key.",
  });
}
