/**
 * The settlement layer — ported verbatim from the production app's
 * src/lib/settlement/records.ts. This is the actual answer to "what can't a
 * smarter model replicate": not authorization (a library call, worth nothing
 * once the format is public) but adjudication — a chain of three signed
 * statements that together make "was this act authorised, and did what
 * happened match" decidable without trusting either participant.
 *
 *   1. the mandate  — the principal authorised this agent, for these acts
 *   2. the decision — the institution permitted or refused this specific act
 *   3. the outcome  — the institution says what it then actually did
 *
 * Every link is an ordinary JWT/JSON record signed by whoever makes the
 * claim — nothing new to learn, which is why a settlement format that needed
 * its own toolchain would be one nobody implements. `buildMandateRef` and
 * `draftDecisionRecord` exist because getting the hash relationships right by
 * hand is exactly the kind of mistake that is invisible until adjudicate()
 * calls the result broken_chain: prevHash on the decision link is the
 * mandate's own token hash, not a fresh hash of the reference object; on the
 * outcome link it genuinely is `hashRecord(decision)`. This module is the one
 * place that distinction is encoded, so no caller has to get it right twice.
 */

import { createHash, randomUUID } from "crypto";
import type { MandateClaims } from "./mandate.js";

export type Minor = number;

export interface MandateRef {
  jti: string;
  iss: string;
  aud: string;
  sub: string;
  scopes: readonly string[];
  nbf: number;
  exp: number;
  /** SHA-256 of the mandate's compact JWS, hex. Pins the exact token. */
  hash: string;
}

export interface DecisionRecord {
  id: string;
  /** The institution that made the decision. Signs this record. */
  institution: string;
  mandateJti: string;
  /** Equal to `MandateRef.hash` — see module doc. */
  prevHash: string;
  action: string;
  decision: "permit" | "deny";
  /** Present on deny. */
  reason?: string;
  at: number;
  actConfirmation?: string;
}

export interface OutcomeRecord {
  id: string;
  /** Whoever is asserting what happened. Signs this record. */
  institution: string;
  /** Equal to `hashRecord(decision)` — see module doc. */
  prevHash: string;
  action: string;
  result: "completed" | "refused" | "partial";
  amountMinor?: Minor;
  currency?: string;
  ref?: string;
  at: number;
}

export interface SettlementChain {
  mandate: MandateRef;
  decision?: DecisionRecord;
  outcome?: OutcomeRecord;
}

/**
 * The first link. `claims` is whatever `verifyMandate` returned; `token` is
 * the exact compact JWS it verified — the ref's `hash` pins that string, not
 * a re-hash of any field inside it.
 */
export function buildMandateRef(
  claims: Pick<MandateClaims, "jti" | "iss" | "aud" | "sub" | "scopes" | "nbf" | "exp">,
  token: string,
): MandateRef {
  return {
    jti: claims.jti,
    iss: claims.iss,
    aud: claims.aud,
    sub: claims.sub,
    scopes: claims.scopes,
    nbf: claims.nbf,
    exp: claims.exp,
    hash: createHash("sha256").update(token, "utf8").digest("hex"),
  };
}

/**
 * The second link, drafted — not signed. Only the named `institution` may
 * sign it; this function never signs on that party's behalf, because a
 * decision is an assertion only the deciding institution can honestly make.
 */
export function draftDecisionRecord(
  mandate: MandateRef,
  params: {
    institution: string;
    action: string;
    decision: "permit" | "deny";
    reason?: string;
    actConfirmation?: string;
    now?: Date;
  },
): DecisionRecord {
  return {
    id: randomUUID(),
    institution: params.institution,
    mandateJti: mandate.jti,
    prevHash: mandate.hash,
    action: params.action,
    decision: params.decision,
    reason: params.reason,
    at: Math.floor((params.now ?? new Date()).getTime() / 1000),
    actConfirmation: params.actConfirmation,
  };
}

/**
 * Canonical hash of a record. Keys are sorted before serialisation so two
 * implementations that build the same record in a different field order
 * produce the same hash — without this the chain breaks between languages,
 * the single most common way a signed-record format fails in practice.
 */
export function hashRecord(record: unknown): string {
  return createHash("sha256").update(canonical(record), "utf8").digest("hex");
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}

export type Verdict =
  | "performed_as_authorized"
  | "authorized_not_performed"
  | "refused_with_reason"
  | "unauthorized"
  | "exceeded_scope"
  | "outside_mandate_window"
  | "broken_chain"
  /** A real verdict, not a failure. A procedure that always produces a winner sometimes invents one. */
  | "indeterminate";

export interface Adjudication {
  verdict: Verdict;
  /** Which party the records place the burden on next — never a moral judgement. */
  burden: "institution" | "agent" | "none";
  settledMinor: Minor;
  detail: string;
}

function verdictOf(verdict: Verdict, burden: Adjudication["burden"], detail: string, settledMinor = 0): Adjudication {
  return { verdict, burden, settledMinor, detail };
}

/**
 * Who is right, from the records alone. Pure and total: every input yields a
 * verdict, no input throws — an authorization function a caller wraps in a
 * try/catch is one whose catch block eventually decides a dispute.
 */
export function adjudicate(chain: SettlementChain, now: Date = new Date()): Adjudication {
  const { mandate, decision, outcome } = chain;
  const nowSec = Math.floor(now.getTime() / 1000);

  if (outcome && !decision) {
    return verdictOf("unauthorized", "institution", "an outcome was asserted with no decision record preceding it");
  }
  if (!decision) {
    return verdictOf("indeterminate", "none", "no decision has been recorded against this mandate");
  }
  if (decision.mandateJti !== mandate.jti) {
    return verdictOf("broken_chain", "institution", "decision references a different mandate");
  }
  if (decision.prevHash !== mandate.hash) {
    return verdictOf("broken_chain", "institution", "decision does not follow the mandate it names");
  }

  if (decision.decision === "deny") {
    if (outcome && outcome.result !== "refused") {
      return verdictOf(
        "unauthorized",
        "institution",
        "an act was performed after the institution's own record refused it",
      );
    }
    return verdictOf("refused_with_reason", "none", `refused: ${decision.reason ?? "no reason recorded"}`);
  }

  if (decision.at < mandate.nbf || decision.at >= mandate.exp) {
    return verdictOf("outside_mandate_window", "institution", "the decision was taken outside the mandate's validity period");
  }
  if (!mandate.scopes.includes(decision.action)) {
    return verdictOf("exceeded_scope", "institution", "the permitted action is not among the mandate's scopes");
  }

  if (!outcome) {
    return verdictOf(
      "authorized_not_performed",
      "institution",
      nowSec > decision.at ? "permitted, but no outcome has been recorded" : "permitted; outcome not yet due",
    );
  }

  if (outcome.prevHash !== hashRecord(decision)) {
    return verdictOf("broken_chain", "institution", "outcome does not follow the decision it names");
  }
  if (outcome.action !== decision.action) {
    return verdictOf("exceeded_scope", "institution", "the outcome describes a different act from the one permitted");
  }
  if (outcome.at < decision.at) {
    return verdictOf("broken_chain", "institution", "the outcome predates the decision");
  }
  if (outcome.at >= mandate.exp) {
    return verdictOf("outside_mandate_window", "institution", "the act was carried out after the mandate expired");
  }
  if (outcome.result === "refused") {
    return verdictOf("refused_with_reason", "none", "permitted, then not carried out; the institution recorded a refusal");
  }

  const amount = outcome.amountMinor ?? 0;
  if (!Number.isInteger(amount) || amount < 0) {
    return verdictOf("indeterminate", "institution", "the outcome carries a malformed amount");
  }

  return verdictOf(
    "performed_as_authorized",
    "none",
    outcome.result === "partial" ? "carried out in part" : "carried out as authorised",
    amount,
  );
}

/** Is this chain safe to publish into a de-identified outcome graph? */
export function publishable(chain: SettlementChain, verdict: Verdict): boolean {
  if (verdict === "indeterminate" || verdict === "broken_chain") return false;
  return Boolean(chain.decision);
}

export interface GraphRow {
  institution: string;
  action: string;
  verdict: Verdict;
  daysToOutcome: number | null;
  amountBand: "none" | "under_100" | "under_1k" | "under_10k" | "over_10k";
}

function band(minor: Minor): GraphRow["amountBand"] {
  if (minor <= 0) return "none";
  if (minor < 10_000) return "under_100";
  if (minor < 100_000) return "under_1k";
  if (minor < 1_000_000) return "under_10k";
  return "over_10k";
}

export function toGraphRow(chain: SettlementChain, adj: Adjudication): GraphRow | null {
  if (!publishable(chain, adj.verdict)) return null;
  const d = chain.decision!;
  return {
    institution: d.institution,
    action: d.action,
    verdict: adj.verdict,
    daysToOutcome: chain.outcome ? Math.max(0, Math.floor((chain.outcome.at - d.at) / 86_400)) : null,
    amountBand: band(adj.settledMinor),
  };
}
