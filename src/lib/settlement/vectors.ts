/**
 * Settlement test vectors — the second layer, made implementable by strangers.
 *
 * The authorization layer got vectors and five independent implementations, and
 * writing them found three real defects. The settlement layer is currently
 * where authorization was before that: one implementation, prose only, and
 * every ambiguity in the prose still undiscovered.
 *
 * It also has a failure mode authorization does not, and it is the one that
 * actually breaks signed-record formats in the field: **canonical hashing**.
 * Every link in the chain points at the previous one by hash, so two
 * implementations that serialise the same record differently — a different key
 * order, a differently handled absent field — compute different hashes, reject
 * each other's perfectly valid chains, and each concludes the other's crypto is
 * broken. That is not a hypothetical; it is the single most common way this
 * category of format fails between languages.
 *
 * So the vectors publish the expected hash of every record alongside the
 * expected verdict. An implementation that produces the right verdict from the
 * wrong hash has not agreed with us about anything, and would fail the moment
 * it met a chain it had not built itself.
 */

import {
  adjudicate,
  hashRecord,
  type DecisionRecord,
  type MandateRef,
  type OutcomeRecord,
  type SettlementChain,
  type Verdict,
} from "./records";

/** The instant every vector is evaluated at. Fixed, so results never drift. */
export const SETTLEMENT_TEST_NOW = 1_800_000_000;

const HOUR = 3600;

const MANDATE: MandateRef = {
  jti: "mnd_settlement_vector",
  iss: "https://test.zakai.invalid",
  aud: "test-institution",
  sub: "usr_vector_1",
  scopes: ["dispute:charge", "read:accounts"],
  nbf: SETTLEMENT_TEST_NOW - 10 * HOUR,
  exp: SETTLEMENT_TEST_NOW + 10 * HOUR,
  // A fixed, obviously synthetic value. Real chains carry the SHA-256 of the
  // mandate's compact JWS; a vector must not depend on a signature nobody can
  // reproduce without the private key.
  hash: "0".repeat(64),
};

function dec(over: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    id: "dec_vector",
    institution: "test-institution",
    mandateJti: MANDATE.jti,
    prevHash: MANDATE.hash,
    action: "dispute:charge",
    decision: "permit",
    at: SETTLEMENT_TEST_NOW - 5 * HOUR,
    actConfirmation: "cnf_vector",
    ...over,
  };
}

function out(decision: DecisionRecord, over: Partial<OutcomeRecord> = {}): OutcomeRecord {
  return {
    id: "out_vector",
    institution: "test-institution",
    prevHash: hashRecord(decision),
    action: decision.action,
    result: "completed",
    amountMinor: 42_000,
    currency: "ILS",
    ref: "CASE-VECTOR",
    at: SETTLEMENT_TEST_NOW - HOUR,
    ...over,
  };
}

export interface SettlementVector {
  id: string;
  /** What ambiguity this vector pins down. Written for the implementer. */
  pins: string;
  chain: SettlementChain;
  expect: { verdict: Verdict; burden: "institution" | "agent" | "none"; settledMinor: number };
}

function vector(
  id: string,
  pins: string,
  chain: SettlementChain,
  expect: SettlementVector["expect"],
): SettlementVector {
  return { id, pins, chain, expect };
}

const permitted = dec();
const denied = dec({ decision: "deny", reason: "scope_not_granted" });

export const SETTLEMENT_VECTORS: readonly SettlementVector[] = [
  vector(
    "performed_as_authorized",
    "A complete, consistent chain. The baseline every implementation must agree on before anything else is meaningful.",
    { mandate: MANDATE, decision: permitted, outcome: out(permitted) },
    { verdict: "performed_as_authorized", burden: "none", settledMinor: 42_000 },
  ),
  vector(
    "partial_still_counts_as_performed",
    "A partial outcome is performed, not a failure. Treating it as fault would penalise the institution that did most of the work and said so.",
    { mandate: MANDATE, decision: permitted, outcome: out(permitted, { result: "partial" }) },
    { verdict: "performed_as_authorized", burden: "none", settledMinor: 42_000 },
  ),
  vector(
    "unauthorized_outcome_with_no_decision",
    "Something was done and nobody can point at the permission for it. The case this whole layer exists for.",
    { mandate: MANDATE, outcome: out(permitted) },
    { verdict: "unauthorized", burden: "institution", settledMinor: 0 },
  ),
  vector(
    "unauthorized_act_after_own_refusal",
    "An act carried out after the institution's own record refused it.",
    { mandate: MANDATE, decision: denied, outcome: out(denied, { result: "completed" }) },
    { verdict: "unauthorized", burden: "institution", settledMinor: 0 },
  ),
  vector(
    "silence_after_permit",
    "Permitted, then nothing. The verdict that makes silence expensive, which is the point — the burden sits with the party holding the record of what it did.",
    { mandate: MANDATE, decision: permitted },
    { verdict: "authorized_not_performed", burden: "institution", settledMinor: 0 },
  ),
  vector(
    "refusal_is_not_fault",
    "A recorded refusal carries no burden. Punishing the participants who behave correctly is how a network loses them.",
    { mandate: MANDATE, decision: denied },
    { verdict: "refused_with_reason", burden: "none", settledMinor: 0 },
  ),
  vector(
    "permitted_then_recorded_as_not_done",
    "Permitted, then the institution recorded that it did not act. Still not fault.",
    { mandate: MANDATE, decision: permitted, outcome: out(permitted, { result: "refused" }) },
    { verdict: "refused_with_reason", burden: "none", settledMinor: 0 },
  ),
  vector(
    "broken_chain_wrong_mandate",
    "A decision naming a different mandate.",
    { mandate: MANDATE, decision: dec({ mandateJti: "mnd_other" }) },
    { verdict: "broken_chain", burden: "institution", settledMinor: 0 },
  ),
  vector(
    "broken_chain_substituted_mandate",
    "The substitution attack: swap in a more permissive mandate after the fact. The previous-hash link is what makes it visible.",
    { mandate: MANDATE, decision: dec({ prevHash: "f".repeat(64) }) },
    { verdict: "broken_chain", burden: "institution", settledMinor: 0 },
  ),
  vector(
    "broken_chain_edited_decision",
    "A decision edited after its outcome was signed. The outcome pins the decision by hash, so history cannot be rewritten quietly — and this vector only passes if your canonical hashing matches ours exactly.",
    {
      mandate: MANDATE,
      decision: { ...permitted, action: "read:accounts" },
      outcome: out(permitted),
    },
    { verdict: "broken_chain", burden: "institution", settledMinor: 0 },
  ),
  vector(
    "broken_chain_outcome_predates_decision",
    "An outcome dated before the decision that permitted it.",
    {
      mandate: MANDATE,
      decision: permitted,
      outcome: out(permitted, { at: permitted.at - 1 }),
    },
    { verdict: "broken_chain", burden: "institution", settledMinor: 0 },
  ),
  vector(
    "exceeded_scope_permit_beyond_mandate",
    "The institution's own decision cannot widen the principal's grant.",
    { mandate: MANDATE, decision: dec({ action: "read:payroll" }) },
    { verdict: "exceeded_scope", burden: "institution", settledMinor: 0 },
  ),
  vector(
    "exceeded_scope_outcome_differs_from_permit",
    "The outcome describes a different act from the one permitted, with the chain otherwise intact.",
    {
      mandate: MANDATE,
      decision: permitted,
      outcome: { ...out(permitted), action: "read:accounts", prevHash: hashRecord(permitted) },
    },
    { verdict: "exceeded_scope", burden: "institution", settledMinor: 0 },
  ),
  vector(
    "outside_window_decision_before_start",
    "A decision taken before the mandate began.",
    { mandate: MANDATE, decision: dec({ at: MANDATE.nbf - 1 }) },
    { verdict: "outside_mandate_window", burden: "institution", settledMinor: 0 },
  ),
  vector(
    "outside_window_decision_after_expiry",
    "A decision taken after the mandate expired.",
    { mandate: MANDATE, decision: dec({ at: MANDATE.exp + 1 }) },
    { verdict: "outside_mandate_window", burden: "institution", settledMinor: 0 },
  ),
  vector(
    "outside_window_acted_after_expiry",
    "The realistic version: permitted while live, acted on long after. The decision is timely and the act is not.",
    {
      mandate: MANDATE,
      decision: permitted,
      outcome: { ...out(permitted), at: MANDATE.exp + 100, prevHash: hashRecord(permitted) },
    },
    { verdict: "outside_mandate_window", burden: "institution", settledMinor: 0 },
  ),
  vector(
    "indeterminate_nothing_recorded",
    "No decision at all. A real verdict, not a failure: a procedure that always produces a winner will sometimes invent one.",
    { mandate: MANDATE },
    { verdict: "indeterminate", burden: "none", settledMinor: 0 },
  ),
  vector(
    "indeterminate_fractional_amount",
    "A fractional amount is refused rather than rounded. A settlement layer that quietly rounds is one whose totals stop reconciling, and the first to notice is whoever is owed the rounding.",
    {
      mandate: MANDATE,
      decision: permitted,
      outcome: out(permitted, { amountMinor: 12.5 }),
    },
    { verdict: "indeterminate", burden: "institution", settledMinor: 0 },
  ),
  vector(
    "indeterminate_negative_amount",
    "Negative money is refused rather than coerced.",
    {
      mandate: MANDATE,
      decision: permitted,
      outcome: out(permitted, { amountMinor: -1 }),
    },
    { verdict: "indeterminate", burden: "institution", settledMinor: 0 },
  ),
  vector(
    "zero_when_no_money_moved",
    "A read act settles at zero rather than being treated as unquantified.",
    {
      mandate: MANDATE,
      decision: dec({ action: "read:accounts", actConfirmation: undefined }),
      outcome: out(dec({ action: "read:accounts", actConfirmation: undefined }), {
        amountMinor: undefined,
      }),
    },
    { verdict: "performed_as_authorized", burden: "none", settledMinor: 0 },
  ),
];

export interface SettlementVectorResult {
  id: string;
  expected: string;
  actual: string;
}

export interface SettlementVectorReport {
  total: number;
  passed: number;
  failed: SettlementVectorResult[];
  conformant: boolean;
}

function key(v: { verdict: string; burden: string; settledMinor: number }): string {
  return `${v.verdict}/${v.burden}/${v.settledMinor}`;
}

/**
 * Run a candidate implementation against the settlement vectors.
 *
 * Takes the implementation as a function so anybody can point this at their own
 * code without depending on ours — the same independence that makes the
 * authorization conformance tool mean anything.
 */
export function runSettlementVectors(
  impl: (chain: SettlementChain, now: Date) => {
    verdict: string;
    burden: string;
    settledMinor: number;
  },
): SettlementVectorReport {
  const failed: SettlementVectorResult[] = [];
  const now = new Date(SETTLEMENT_TEST_NOW * 1000);

  for (const v of SETTLEMENT_VECTORS) {
    const expected = key(v.expect);
    let actual: string;
    try {
      actual = key(impl(v.chain, now));
    } catch (err) {
      // A throw is a failure, not a crash of the harness.
      actual = `threw:${err instanceof Error ? err.message : String(err)}`;
    }
    if (actual !== expected) failed.push({ id: v.id, expected, actual });
  }

  return {
    total: SETTLEMENT_VECTORS.length,
    passed: SETTLEMENT_VECTORS.length - failed.length,
    failed,
    conformant: failed.length === 0,
  };
}

/**
 * The published form.
 *
 * Includes canonical-hash fixtures separately from the chains. An
 * implementation whose serialisation differs from ours will produce the right
 * verdict on chains it built itself and reject every chain built by anybody
 * else, so the hashing must be checkable on its own before the verdicts mean
 * anything.
 */
export function settlementVectorDocument() {
  return {
    spec: "zakai-settlement-test-vectors",
    version: 1,
    evaluated_at_unix: SETTLEMENT_TEST_NOW,
    canonicalisation: {
      algorithm: "sha256",
      encoding: "hex",
      // Stated because these three rules are the whole of it, and each is a
      // place two implementations silently diverge.
      rules: [
        "object keys sorted by code unit, ascending",
        "fields whose value is undefined are omitted entirely, so an absent field and an explicitly-undefined one hash identically",
        "no insignificant whitespace; arrays keep their order",
      ],
      // Check these first. Right verdict from the wrong hash is agreement about
      // nothing, and it fails the moment you meet a chain you did not build.
      fixtures: [
        { record: { a: 1, b: 2 }, sha256: hashRecord({ a: 1, b: 2 }) },
        { record: { b: 2, a: 1 }, sha256: hashRecord({ b: 2, a: 1 }) },
        { record: { a: 1 }, sha256: hashRecord({ a: 1 }) },
        { record: { nested: { z: 1, a: [1, 2] } }, sha256: hashRecord({ nested: { z: 1, a: [1, 2] } }) },
        { record: dec(), sha256: hashRecord(dec()) },
      ],
    },
    verdicts: [
      "performed_as_authorized",
      "authorized_not_performed",
      "refused_with_reason",
      "unauthorized",
      "exceeded_scope",
      "outside_mandate_window",
      "broken_chain",
      "indeterminate",
    ],
    vectors: SETTLEMENT_VECTORS.map((v) => ({
      id: v.id,
      pins: v.pins,
      chain: v.chain,
      expect: v.expect,
    })),
  };
}

/** Our own implementation, for the test that keeps us honest. */
export function selfCheck(): SettlementVectorReport {
  return runSettlementVectors((chain, now) => adjudicate(chain, now));
}
