import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { issueMandate, loadSigningKeyFromEnv, MandateKeyUnavailableError } from "@/lib/mandate/mandate";
import { allocateStatusIndex, statusListUriForIssuer } from "@/lib/mandate/statusIndex";
import { checkAuthorizationAsk, REQUEST_TTL_MS, type AskRejection } from "@/lib/agentAuth/request";

/**
 * The handshake that lets a person lend authority to somebody else's agent.
 *
 * THE SHAPE, AND WHY IT IS THIS SHAPE
 *
 * An agent asks. A human answers. Only then does anything get signed. The
 * agent never touches the moment of consent, and Zakai never mints authority
 * because a machine requested it — a mandate issued without a human act is
 * precisely the thing that would make every institution stop honouring all of
 * them, and this network is worth exactly what institutions think it is worth.
 *
 * The one-time code between approval and delivery is not ceremony. Without it,
 * the signed mandate would travel back on a redirect, through the person's
 * browser, into logs and history and any referrer along the way. With it, the
 * browser carries a value that is useless to anyone but the agent that asked,
 * once, and the mandate itself moves server to server.
 */

/** The person's answer has to reach us before the request goes stale. */
export function requestExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + REQUEST_TTL_MS);
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** `dana@example.com` -> `d***@example.com`. Enough to recognise, not to reuse. */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "";
  return `${email[0]}***${email.slice(at)}`;
}

export type StartResult =
  | { ok: true; requestId: string; authorizeUrl: string; expiresAt: Date }
  | { ok: false; reason: AskRejection | "unknown_agent" };

export async function startAuthorizationRequest(
  origin: string,
  input: {
    agentSlug: string;
    scopes: string[];
    purpose: string;
    redirectUri: string;
    state?: string;
    grantSeconds?: number;
  },
): Promise<StartResult> {
  const agent = await prisma.agentClient.findUnique({ where: { slug: input.agentSlug } });
  /**
   * An unregistered agent and a suspended one get different answers on
   * purpose. "Unknown" is not a secret — the slug is public, it appears on
   * every consent screen — and telling an integrator their slug is wrong
   * saves a day of debugging. What must never leak is anything about a
   * *person*, and none of this touches one.
   */
  if (!agent) return { ok: false, reason: "unknown_agent" };

  const check = checkAuthorizationAsk(
    {
      slug: agent.slug,
      name: agent.name,
      redirectUris: agent.redirectUris,
      status: agent.status,
    },
    {
      scopes: input.scopes,
      purpose: input.purpose,
      redirectUri: input.redirectUri,
      grantSeconds: input.grantSeconds,
    },
  );
  if (!check.ok) return { ok: false, reason: check.reason };

  const expiresAt = requestExpiry();
  const request = await prisma.agentAuthorizationRequest.create({
    data: {
      clientId: agent.id,
      scopes: check.scopes,
      purpose: input.purpose.trim().slice(0, 400),
      redirectUri: input.redirectUri,
      state: (input.state ?? "").slice(0, 200),
      grantSeconds: check.grantSeconds,
      expiresAt,
    },
  });

  return {
    ok: true,
    requestId: request.id,
    authorizeUrl: `${origin}/he/authorize?req=${request.id}`,
    expiresAt,
  };
}

export type DecisionResult =
  | { ok: true; redirectTo: string }
  | { ok: false; reason: "not_found" | "already_decided" | "expired" | "signing_unavailable" };

/**
 * Record the person's answer, and on a yes, sign the grant.
 *
 * `updateMany` with the status in the where-clause rather than a read-then-
 * write: two taps on a slow connection must not produce two mandates for one
 * decision. The same shape the fee and plan confirmations use, for the same
 * reason.
 */
export async function decideAuthorization(
  requestId: string,
  userId: string,
  approve: boolean,
  now: Date = new Date(),
): Promise<DecisionResult> {
  const request = await prisma.agentAuthorizationRequest.findUnique({
    where: { id: requestId },
    include: { client: true },
  });
  if (!request) return { ok: false, reason: "not_found" };
  if (request.status !== "pending") return { ok: false, reason: "already_decided" };
  if (request.expiresAt <= now) return { ok: false, reason: "expired" };

  if (!approve) {
    const claimed = await prisma.agentAuthorizationRequest.updateMany({
      where: { id: requestId, status: "pending" },
      data: { status: "denied", userId },
    });
    if (claimed.count === 0) return { ok: false, reason: "already_decided" };
    const url = new URL(request.redirectUri);
    url.searchParams.set("error", "access_denied");
    if (request.state) url.searchParams.set("state", request.state);
    return { ok: true, redirectTo: url.toString() };
  }

  let key;
  try {
    key = loadSigningKeyFromEnv();
  } catch (err) {
    if (err instanceof MandateKeyUnavailableError) {
      // Refuse rather than hand back an unsigned grant. An institution cannot
      // verify what was never signed, and a person told they authorised
      // something that carries no proof is worse off than one told no.
      return { ok: false, reason: "signing_unavailable" };
    }
    throw err;
  }

  const issuer = process.env.MANDATE_ISSUER || "https://zakai-3uxj.vercel.app";
  const person = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  if (!person) return { ok: false, reason: "not_found" };

  const jti = randomUUID();
  const code = randomBytes(32).toString("base64url");

  const claimed = await prisma.agentAuthorizationRequest.updateMany({
    where: { id: requestId, status: "pending" },
    data: { status: "approved", userId, approvedAt: now, codeHash: hashCode(code) },
  });
  if (claimed.count === 0) return { ok: false, reason: "already_decided" };

  let status: { idx: number; uri: string } | undefined;
  try {
    const idx = await prisma.$transaction((tx) => allocateStatusIndex(tx, jti));
    status = { idx, uri: statusListUriForIssuer(issuer) };
  } catch {
    // A grant with no status entry is still a real, expiring grant; one that
    // never got issued because the status store hiccuped is a person who tried
    // to say yes and was told no.
    status = undefined;
  }

  const jws = await issueMandate(
    {
      jti,
      issuer,
      audience: request.client.slug,
      subject: userId,
      /**
       * The masked contact is what a human on the institution's side checks
       * the grant against. The full address never travels in a token that
       * will be handed to a third party and logged by whoever verifies it.
       */
      principal: { name: person.name, contactMasked: maskEmail(person.email) },
      scopes: request.scopes,
      market: "IL",
      ttlSeconds: request.grantSeconds,
      statement: request.purpose,
      status,
    },
    key,
  );

  await prisma.agentAuthorizationRequest.update({
    where: { id: requestId },
    data: { mandateJws: jws, mandateJti: jti },
  });

  const url = new URL(request.redirectUri);
  url.searchParams.set("code", code);
  if (request.state) url.searchParams.set("state", request.state);
  return { ok: true, redirectTo: url.toString() };
}

export type ExchangeResult =
  | { ok: true; mandateJws: string; expiresIn: number }
  | { ok: false; reason: "invalid_code" };

/**
 * Trade the one-time code for the mandate, exactly once.
 *
 * Every failure returns the same `invalid_code`. A code that was already spent,
 * one from another agent, one that never existed and one whose request expired
 * are four different facts, and telling them apart would let somebody probe
 * this endpoint to learn which grants exist.
 */
export async function exchangeAuthorizationCode(
  agentSlug: string,
  code: string,
  now: Date = new Date(),
): Promise<ExchangeResult> {
  if (!code) return { ok: false, reason: "invalid_code" };
  const request = await prisma.agentAuthorizationRequest.findUnique({
    where: { codeHash: hashCode(code) },
    include: { client: true },
  });
  if (!request) return { ok: false, reason: "invalid_code" };
  if (request.client.slug !== agentSlug) return { ok: false, reason: "invalid_code" };
  if (request.status !== "approved" || !request.mandateJws) {
    return { ok: false, reason: "invalid_code" };
  }

  const claimed = await prisma.agentAuthorizationRequest.updateMany({
    where: { id: request.id, status: "approved" },
    data: { status: "exchanged", mandateJws: null, codeHash: null },
  });
  if (claimed.count === 0) return { ok: false, reason: "invalid_code" };

  const approvedAt = request.approvedAt ?? now;
  const elapsed = Math.floor((now.getTime() - approvedAt.getTime()) / 1000);
  return {
    ok: true,
    mandateJws: request.mandateJws,
    expiresIn: Math.max(0, request.grantSeconds - elapsed),
  };
}
