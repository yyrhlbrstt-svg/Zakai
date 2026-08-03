import {
  verifyMandate,
  publicJwkFor,
  loadSigningKeyFromEnv,
  MandateError,
  MandateKeyUnavailableError,
  type MandateClaims,
} from "@/lib/mandate/mandate";
import { decide, permittedActions, type RevocationState } from "@/lib/mandate/decision";
import { buildMandateRef, draftDecisionRecord } from "@/lib/settlement/records";

export type AcceptResult =
  | {
      ok: true;
      accepted: boolean;
      decision: "permit" | "deny";
      reason: string;
      audience: string;
      jti: string;
      principal?: MandateClaims["principal"];
      permitted: string[];
      obligations: string[];
      settlementDecisionDraft?: ReturnType<typeof draftDecisionRecord>;
      settlementNote?: string;
      detail?: string;
    }
  | { ok: false; error: string; need?: string[]; detail?: string; status: number };

function audienceFromJws(jws: string): string | null {
  try {
    const mid = jws.split(".")[1];
    if (!mid) return null;
    const json = Buffer.from(mid, "base64url").toString("utf8");
    const raw = JSON.parse(json) as { aud?: string | string[] };
    return Array.isArray(raw.aud) ? String(raw.aud[0] ?? "") : String(raw.aud ?? "");
  } catch {
    return null;
  }
}

/**
 * Institution one-shot on the pipe: extract aud → verify → revocation → decide.
 * Caller supplies revocation lookup (DB) so this stays testable without Prisma.
 */
export async function acceptMandateOnPipe(input: {
  mandateJws: string;
  action: string;
  subject?: string;
  market?: string;
  actConfirmation?: string;
  lookupRevocation: (jti: string) => Promise<RevocationState>;
}): Promise<AcceptResult> {
  const token = input.mandateJws.trim();
  const action = input.action.trim();
  if (!token || !action) {
    return { ok: false, error: "missing_fields", need: ["mandate_jws", "action"], status: 400 };
  }
  if (token.length > 16_384) {
    return { ok: false, error: "token_too_large", status: 400 };
  }

  const audience = audienceFromJws(token);
  if (!audience) {
    return { ok: false, error: "missing_audience", status: 400 };
  }

  try {
    const key = loadSigningKeyFromEnv();
    const jwk = await publicJwkFor(key);
    const claims = await verifyMandate(token, { audience, publicJwks: [jwk] });
    const revocation = await input.lookupRevocation(claims.jti);

    const decideInput = {
      claims,
      audience,
      subject: input.subject?.trim() || undefined,
      market: input.market?.trim() || undefined,
      revocation,
    };
    const result = decide({
      ...decideInput,
      action,
      actConfirmation: input.actConfirmation,
    });

    const mandateRef = buildMandateRef(claims, token);
    const settlementDecisionDraft = draftDecisionRecord(mandateRef, {
      institution: audience,
      action,
      decision: result.decision,
      reason: result.reason,
      actConfirmation: input.actConfirmation,
    });

    return {
      ok: true,
      accepted: result.decision === "permit",
      decision: result.decision,
      reason: result.reason ?? (result.decision === "permit" ? "ok" : "deny"),
      audience,
      jti: claims.jti,
      principal: result.decision === "permit" ? claims.principal : undefined,
      permitted: permittedActions(decideInput),
      obligations: result.obligations,
      settlementDecisionDraft,
      settlementNote:
        "Sign this record with your own key to create the settlement chain's decision link.",
    };
  } catch (err) {
    if (err instanceof MandateKeyUnavailableError) {
      return { ok: false, error: "issuer_key_unavailable", status: 503 };
    }
    if (err instanceof MandateError) {
      // Same contract as /api/mandate/decide: deny is a successful answer.
      return {
        ok: true,
        accepted: false,
        decision: "deny",
        reason: "invalid_token",
        audience,
        jti: "",
        permitted: [],
        obligations: [],
        detail: err.message,
        settlementNote: "Token failed verification — do not process the act.",
      };
    }
    return {
      ok: false,
      error: "verification_failed",
      detail: err instanceof Error ? err.message : "unknown",
      status: 500,
    };
  }
}
