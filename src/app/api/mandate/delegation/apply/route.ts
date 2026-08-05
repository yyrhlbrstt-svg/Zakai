import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/messaging";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { badRequest } from "@/lib/api";
import { reportError } from "@/lib/report-error";
import { FORBIDDEN_SCOPES, isKnownScope, SCOPES } from "@/lib/mandate/scopes";
import { isForbiddenAnywhere } from "@/lib/mandate/domains";
import { salesInboundEmail } from "@/lib/contact";

/**
 * The self-serve front door to becoming a delegated issuer.
 *
 * Before this endpoint, the only way to get here was finding a human and
 * emailing them — which meant every third-party agent that might have adopted
 * the format first had to identify the right person at Zakai, a step that
 * kills the majority of people who would otherwise have just filled in a form
 * and moved on. `delegation.ts` already lets an agent skip running its own
 * Ed25519 infrastructure; this lets it skip finding us too.
 *
 * What stays manual, deliberately: turning an approved application into an
 * actual DelegatedIssuer row with a real key. Admission to a trust boundary
 * is not something to automate away, and every mandate a delegated issuer
 * signs afterward will carry that issuer's name — this is the one place a
 * human should still look before that starts happening.
 */

const SALES_EMAIL = salesInboundEmail();

const schema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/, "slug must be lowercase alphanumeric with . or -"),
  name: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(160),
  useCase: z.string().trim().min(20).max(2000),
  requestedScopes: z.array(z.string()).min(1).max(32),
});

export async function POST(request: Request) {
  const limited = await rateLimit("delegation-apply", clientIp(request), 5, 3600);
  if (!limited.ok) return badRequest("tooManyRequests", 429);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const { slug, name, contactEmail, useCase, requestedScopes } = parsed.data;

  // Checked and reported immediately, not left for a human reviewer to find
  // days later — an applicant who asked for a forbidden or nonexistent scope
  // should learn that from the form, not from silence.
  const forbidden = requestedScopes.filter(
    (s) => isForbiddenAnywhere(s) || FORBIDDEN_SCOPES.includes(s),
  );
  if (forbidden.length > 0) {
    return NextResponse.json(
      { error: "scope_forbidden", scopes: forbidden },
      { status: 400 },
    );
  }
  const unknown = requestedScopes.filter((s) => !isKnownScope(s));
  if (unknown.length > 0) {
    return NextResponse.json(
      { error: "scope_unknown", scopes: unknown, known: SCOPES.map((s) => s.scope) },
      { status: 400 },
    );
  }

  let applicationId: string;
  try {
    const created = await prisma.delegationApplication.create({
      data: { slug, name, contactEmail, useCase, requestedScopes },
    });
    applicationId = created.id;
  } catch (err) {
    await reportError(err, { route: "delegation-apply-persist" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  try {
    await sendEmail({
      to: SALES_EMAIL,
      subject: `Mandate delegation application — ${name} (${slug})`,
      body: `New delegated-issuer application:

Slug: ${slug}
Name: ${name}
Contact: ${contactEmail}
Requested scopes: ${requestedScopes.join(", ")}

Use case:
${useCase}

—
If approved: POST /api/mandate/delegation/issuers (Authorization: Bearer $ZAKAI_ADMIN_TOKEN)
  {"applicationId":"${applicationId}","slug":"${slug}","name":"${name}","allowedScopes":${JSON.stringify(requestedScopes)}}
Returns the real key once — store it before closing the response. See src/lib/mandate/delegation.ts.`,
    });
  } catch (err) {
    // The application row is already saved; a failed notification is our
    // problem to notice, not a reason to tell the applicant it didn't work.
    await reportError(err, { route: "delegation-apply-notify" });
  }

  return NextResponse.json({ ok: true });
}
