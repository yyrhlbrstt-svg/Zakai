/**
 * The second layer: what was agreed, what happened, and who is right.
 *
 * WHY AUTHORIZATION ALONE IS NOT A NETWORK
 *
 * The mandate layer answers "may this agent act". That is necessary, it is the
 * part everyone thinks is the product, and it is the part that commoditises
 * first — the moment a format is public, verifying a signature is a library
 * call and worth nothing.
 *
 * Visa is instructive here and almost always misread. Visa does not move money
 * and its authorization step is close to free. What Visa actually sells is the
 * second layer: when the cardholder and the merchant disagree about what was
 * authorised, there is a record neither of them controls, a procedure that runs
 * the same way every time, and an outcome both sides accepted in advance. The
 * network is the adjudication, not the approval.
 *
 * No such layer exists for AI agents, and every party is about to need one. An
 * agent says it was told to cancel; the institution says nothing arrived; the
 * consumer says they never agreed to that. Today the resolution is a call
 * centre reading logs owned by one of the disputants, which is not a procedure,
 * it is a coin flip decided by whoever has better records.
 *
 * WHAT THIS FILE IS
 *
 * A chain of three signed statements that together make the question decidable
 * without trusting any participant:
 *
 *   1. the mandate    — the principal authorised this agent, for these acts
 *   2. the decision   — the institution permitted or refused this specific act
 *   3. the outcome    — the institution says what it then actually did
 *
 * Each link carries a hash of the previous one, so the order is fixed and any
 * substitution is visible. Every link is an ordinary JWT signed by whoever is
 * making the claim, which means the same verifiers, the same libraries and the
 * same key distribution as the mandate itself. Nothing new to learn is a
 * feature, not a shortcut: a settlement format that needs its own toolchain is
 * one nobody implements.
 *
 * THE PROPERTY THAT MAKES IT INFRASTRUCTURE
 *
 * Adjudication is a pure function of the records. If resolving a dispute needs
 * a human to read anything, this is a support process wearing a protocol's
 * clothes, and it cannot run at the volume agents will produce. So the verdict
 * set is closed, every verdict is derivable from the chain alone, and
 * `indeterminate` is a real verdict rather than a failure — because a procedure
 * that always produces a winner is one that will sometimes invent one.
 *
 * WHAT IT REFUSES TO DECIDE
 *
 * Whether the underlying claim was any good. Whether the money was owed. Those
 * are questions about the world, and a settlement layer that pretends to answer
 * them is making things up. It answers exactly one question — was this act
 * authorised, and did what happened match — which is the question that has no
 * answer today.
 */

import { createHash } from "crypto";

/** Money is always integer minor units. Never a float, anywhere near a fee. */
export type Minor = number;

export interface MandateRef {
  /** The mandate's jti. */
  jti: string;
  /** Issuer of the mandate. */
  iss: string;
  /** Institution the mandate was bound to. */
  aud: string;
  /** Principal's subject id. */
  sub: string;
  scopes: readonly string[];
  /** Unix seconds. */
  nbf: number;
  exp: number;
  /** SHA-256 of the mandate's compact JWS, hex. Pins the exact token. */
  hash: string;
}

export interface DecisionRecord {
  /** This record's own id. */
  id: string;
  /** The institution that made the decision. Signs this record. */
  institution: string;
  /** Which mandate it decided against. */
  mandateJti: string;
  /** Hash of the mandate record this decision answers. */
  prevHash: string;
  action: string;
  decision: "permit" | "deny";
  /** Present on deny. From the decision layer's closed set. */
  reason?: string;
  /** Unix seconds. */
  at: number;
  /** Reference the principal confirmed this specific act with, when required. */
  actConfirmation?: string;
}

export interface OutcomeRecord {
  id: string;
  /** Whoever is asserting what happened. Signs this record. */
  institution: string;
  /** Hash of the decision record this outcome follows. */
  prevHash: string;
  action: string;
  result: "completed" | "refused" | "partial";
  /** What moved toward the principal, if anything. Integer minor units. */
  amountMinor?: Minor;
  currency?: string;
  /** The institution's own reference, so a human can find it later. */
  ref?: string;
  at: number;
}

export interface SettlementChain {
  mandate: MandateRef;
  decision?: DecisionRecord;
  outcome?: OutcomeRecord;
}

/**
 * Canonical hash of a record.
 *
 * Keys are sorted before serialisation so two implementations that build the
 * same record in a different field order produce the same hash. Without this
 * the chain breaks between languages, which is the single most common way a
 * signed-record format fails in practice.
 */
export function hashRecord(record: unknown): string {
  return createHash("sha256").update(canonical(record), "utf8").digest("hex");
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    // Undefined is dropped rather than serialised, so an explicitly absent
    // optional field and an omitted one hash identically.
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}

/**
 * Verdicts. A closed set, because an institution's compliance system will
 * branch on these strings and rewording one breaks their integration.
 */
export type Verdict =
  /** The chain is complete, consistent, and the act was performed as authorised. */
  | "performed_as_authorized"
  /** Authorised and permitted, but nobody has said what happened. */
  | "authorized_not_performed"
  /** The institution refused, and said why. Not a fault — a recorded answer. */
  | "refused_with_reason"
  /** Something was done that no permit covered. */
  | "unauthorized"
  /** What was done is not what was permitted. */
  | "exceeded_scope"
  /** Acted on a mandate that had expired or not yet started. */
  | "outside_mandate_window"
  /** A link does not follow from the one before it. Substitution or corruption. */
  | "broken_chain"
  /** The records genuinely do not settle it. Not a coin flip. */
  | "indeterminate";

export interface Adjudication {
  verdict: Verdict;
  /**
   * Which party the records place the burden on next. Never a moral judgement —
   * it is who holds the missing document.
   */
  burden: "institution" | "agent" | "none";
  /** Money the outcome says moved toward the principal. Integer minor units. */
  settledMinor: Minor;
  /** Human-readable only for logs. Compliance branches on `verdict`, never on this. */
  detail: string;
}

function verdictOf(
  verdict: Verdict,
  burden: Adjudication["burden"],
  detail: string,
  settledMinor = 0,
): Adjudication {
  return { verdict, burden, settledMinor, detail };
}

/**
 * Who is right, from the records alone.
 *
 * Pure and total. Every input yields a verdict and no input throws, for the
 * same reason the decision layer is total: a function a bank wraps in a
 * try/catch is a function whose catch block will eventually decide a dispute.
 */
export function adjudicate(chain: SettlementChain, now: Date = new Date()): Adjudication {
  const { mandate, decision, outcome } = chain;
  const nowSec = Math.floor(now.getTime() / 1000);

  // An outcome with no decision before it is the case this whole layer exists
  // for: something was done and nobody can point at the permission for it.
  if (outcome && !decision) {
    return verdictOf(
      "unauthorized",
      "institution",
      "an outcome was asserted with no decision record preceding it",
    );
  }

  if (!decision) {
    return verdictOf(
      "indeterminate",
      "none",
      "no decision has been recorded against this mandate",
    );
  }

  if (decision.mandateJti !== mandate.jti) {
    return verdictOf("broken_chain", "institution", "decision references a different mandate");
  }
  if (decision.prevHash !== mandate.hash) {
    return verdictOf(
      "broken_chain",
      "institution",
      "decision does not follow the mandate it names",
    );
  }

  if (decision.decision === "deny") {
    // A refusal is a recorded answer, not a failure. Treating it as fault is
    // how a network punishes the institutions that behave correctly.
    if (outcome && outcome.result !== "refused") {
      return verdictOf(
        "unauthorized",
        "institution",
        "an act was performed after the institution's own record refused it",
      );
    }
    return verdictOf(
      "refused_with_reason",
      "none",
      `refused: ${decision.reason ?? "no reason recorded"}`,
    );
  }

  // Permitted. Was it permitted at a time the mandate was actually live?
  if (decision.at < mandate.nbf || decision.at >= mandate.exp) {
    return verdictOf(
      "outside_mandate_window",
      "institution",
      "the decision was taken outside the mandate's validity period",
    );
  }
  if (!mandate.scopes.includes(decision.action)) {
    return verdictOf(
      "exceeded_scope",
      "institution",
      "the permitted action is not among the mandate's scopes",
    );
  }

  if (!outcome) {
    // Permitted and then silence. The burden sits with the institution, which
    // is the party that holds the record of what it did — and this verdict is
    // the one that makes silence expensive, which is the entire point.
    return verdictOf(
      "authorized_not_performed",
      "institution",
      nowSec > decision.at
        ? "permitted, but no outcome has been recorded"
        : "permitted; outcome not yet due",
    );
  }

  if (outcome.prevHash !== hashRecord(decision)) {
    return verdictOf("broken_chain", "institution", "outcome does not follow the decision it names");
  }
  if (outcome.action !== decision.action) {
    return verdictOf(
      "exceeded_scope",
      "institution",
      "the outcome describes a different act from the one permitted",
    );
  }
  if (outcome.at < decision.at) {
    return verdictOf("broken_chain", "institution", "the outcome predates the decision");
  }
  if (outcome.at >= mandate.exp) {
    return verdictOf(
      "outside_mandate_window",
      "institution",
      "the act was carried out after the mandate expired",
    );
  }

  if (outcome.result === "refused") {
    return verdictOf(
      "refused_with_reason",
      "none",
      "permitted, then not carried out; the institution recorded a refusal",
    );
  }

  // Negative or fractional money is rejected rather than coerced. A settlement
  // layer that quietly rounds is one whose totals stop reconciling, and the
  // first party to notice will be the one owed the rounding.
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

/**
 * Is this chain safe to publish into the outcome graph?
 *
 * The graph is the asset that improves with use, and it is de-identified by
 * construction — it must never carry a subject, a principal or an institution's
 * customer reference. This is the gate, so a future caller cannot widen what
 * gets published by editing a query somewhere else.
 */
export function publishable(chain: SettlementChain, verdict: Verdict): boolean {
  if (verdict === "indeterminate" || verdict === "broken_chain") return false;
  return Boolean(chain.decision);
}

/**
 * The de-identified row. No subject, no principal, no reference, no amount
 * precise enough to re-identify a person — only the shape of what happened.
 */
export interface GraphRow {
  institution: string;
  action: string;
  verdict: Verdict;
  /** Days from decision to outcome. The number everybody actually wants. */
  daysToOutcome: number | null;
  /** Order of magnitude only, never the figure. */
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
    daysToOutcome: chain.outcome
      ? Math.max(0, Math.floor((chain.outcome.at - d.at) / 86_400))
      : null,
    amountBand: band(adj.settledMinor),
  };
}
