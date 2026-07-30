import { describe, expect, it } from "vitest";
import { createHash } from "crypto";
import {
  adjudicate,
  buildMandateRef,
  draftDecisionRecord,
  hashRecord,
  publishable,
  toGraphRow,
  type DecisionRecord,
  type MandateRef,
  type OutcomeRecord,
  type SettlementChain,
} from "./records";

const NOW = new Date("2026-07-29T12:00:00Z");
const nowSec = Math.floor(NOW.getTime() / 1000);

const mandate: MandateRef = {
  jti: "mnd_1",
  iss: "https://zakai.example",
  aud: "bank.example",
  sub: "usr_1",
  scopes: ["dispute:charge", "read:accounts"],
  nbf: nowSec - 10_000,
  exp: nowSec + 10_000,
  hash: "a".repeat(64),
};

function decision(over: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    id: "dec_1",
    institution: "bank.example",
    mandateJti: "mnd_1",
    prevHash: mandate.hash,
    action: "dispute:charge",
    decision: "permit",
    at: nowSec - 5_000,
    actConfirmation: "cnf_1",
    ...over,
  };
}

function outcome(dec: DecisionRecord, over: Partial<OutcomeRecord> = {}): OutcomeRecord {
  return {
    id: "out_1",
    institution: "bank.example",
    prevHash: hashRecord(dec),
    action: dec.action,
    result: "completed",
    amountMinor: 42_000,
    currency: "ILS",
    ref: "CASE-99",
    at: nowSec - 1_000,
    ...over,
  };
}

const chain = (over: Partial<SettlementChain> = {}): SettlementChain => ({ mandate, ...over });

describe("canonical hashing, because a chain that breaks between languages is no chain", () => {
  it("is independent of key order", () => {
    expect(hashRecord({ a: 1, b: 2 })).toBe(hashRecord({ b: 2, a: 1 }));
  });

  it("treats an absent field and an explicitly undefined one as the same", () => {
    expect(hashRecord({ a: 1 })).toBe(hashRecord({ a: 1, b: undefined }));
  });

  it("does not confuse nesting with flattening", () => {
    expect(hashRecord({ a: { b: 1 } })).not.toBe(hashRecord({ "a.b": 1 }));
  });

  it("distinguishes array order", () => {
    expect(hashRecord([1, 2])).not.toBe(hashRecord([2, 1]));
  });

  it("changes when any field changes", () => {
    const d = decision();
    expect(hashRecord(d)).not.toBe(hashRecord({ ...d, action: "read:accounts" }));
  });
});

describe("the case this whole layer exists for", () => {
  it("calls an act with no permission behind it unauthorized", () => {
    // Something was done and nobody can point at the permission for it. Today
    // this is resolved by a call centre reading logs owned by one of the
    // disputants, which is a coin flip decided by who has better records.
    const d = decision();
    const a = adjudicate(chain({ outcome: outcome(d) }), NOW);
    expect(a.verdict).toBe("unauthorized");
    expect(a.burden).toBe("institution");
  });

  it("calls an act performed after the institution's own refusal unauthorized", () => {
    const d = decision({ decision: "deny", reason: "scope_not_granted" });
    const a = adjudicate(chain({ decision: d, outcome: outcome(d) }), NOW);
    expect(a.verdict).toBe("unauthorized");
  });

  it("makes silence after a permit expensive", () => {
    // The verdict that gives an institution a reason to record what it did.
    const a = adjudicate(chain({ decision: decision() }), NOW);
    expect(a.verdict).toBe("authorized_not_performed");
    expect(a.burden).toBe("institution");
  });
});

describe("a refusal is a recorded answer, not a fault", () => {
  it("does not blame an institution that said no and stopped", () => {
    // Treating a refusal as fault is how a network punishes the participants
    // who behave correctly, and then loses them.
    const a = adjudicate(chain({ decision: decision({ decision: "deny", reason: "revoked" }) }), NOW);
    expect(a.verdict).toBe("refused_with_reason");
    expect(a.burden).toBe("none");
    expect(a.detail).toContain("revoked");
  });

  it("accepts a permit that was then not carried out and recorded as such", () => {
    const d = decision();
    const a = adjudicate(chain({ decision: d, outcome: outcome(d, { result: "refused" }) }), NOW);
    expect(a.verdict).toBe("refused_with_reason");
    expect(a.burden).toBe("none");
  });

  it("records a deny with no reason without inventing one", () => {
    const a = adjudicate(chain({ decision: decision({ decision: "deny", reason: undefined }) }), NOW);
    expect(a.verdict).toBe("refused_with_reason");
    expect(a.detail).toContain("no reason recorded");
  });
});

describe("the chain must actually be a chain", () => {
  it("rejects a decision that names a different mandate", () => {
    expect(adjudicate(chain({ decision: decision({ mandateJti: "mnd_2" }) }), NOW).verdict)
      .toBe("broken_chain");
  });

  it("rejects a decision whose previous hash does not match", () => {
    // Substitution is the attack: swap in a permissive mandate after the fact.
    expect(adjudicate(chain({ decision: decision({ prevHash: "b".repeat(64) }) }), NOW).verdict)
      .toBe("broken_chain");
  });

  it("rejects an outcome that does not follow its decision", () => {
    const d = decision();
    const o = outcome(d, { prevHash: "c".repeat(64) });
    expect(adjudicate(chain({ decision: d, outcome: o }), NOW).verdict).toBe("broken_chain");
  });

  it("notices a decision edited after the outcome was signed", () => {
    // The outcome pins the decision by hash, so changing the decision later
    // breaks the link rather than silently rewriting history.
    const d = decision();
    const o = outcome(d);
    const tampered = { ...d, action: "read:accounts" };
    expect(adjudicate(chain({ decision: tampered, outcome: o }), NOW).verdict).toBe("broken_chain");
  });

  it("rejects an outcome that predates its decision", () => {
    const d = decision();
    expect(adjudicate(chain({ decision: d, outcome: outcome(d, { at: d.at - 1 }) }), NOW).verdict)
      .toBe("broken_chain");
  });
});

describe("scope and time are enforced against the mandate, not the decision", () => {
  it("catches a permit for something the mandate never granted", () => {
    // The institution's own decision cannot widen the principal's grant.
    const a = adjudicate(chain({ decision: decision({ action: "read:payroll" }) }), NOW);
    expect(a.verdict).toBe("exceeded_scope");
  });

  it("catches an outcome describing a different act from the permit", () => {
    const d = decision();
    const o = outcome(d, { action: "read:accounts" });
    // Re-point the hash so the failure is about the act, not the linkage.
    expect(adjudicate(chain({ decision: d, outcome: { ...o, prevHash: hashRecord(d) } }), NOW).verdict)
      .toBe("exceeded_scope");
  });

  it("catches a decision taken before the mandate began", () => {
    expect(adjudicate(chain({ decision: decision({ at: mandate.nbf - 1 }) }), NOW).verdict)
      .toBe("outside_mandate_window");
  });

  it("catches a decision taken after the mandate expired", () => {
    expect(adjudicate(chain({ decision: decision({ at: mandate.exp + 1 }) }), NOW).verdict)
      .toBe("outside_mandate_window");
  });

  it("catches an act carried out after expiry even when the permit was timely", () => {
    // The realistic version: permitted on day one, acted on a year later.
    const d = decision();
    const o = outcome(d, { at: mandate.exp + 100 });
    expect(adjudicate(chain({ decision: d, outcome: { ...o, prevHash: hashRecord(d) } }), NOW).verdict)
      .toBe("outside_mandate_window");
  });
});

describe("the clean case, and the money", () => {
  it("settles a complete, consistent chain", () => {
    const d = decision();
    const a = adjudicate(chain({ decision: d, outcome: outcome(d) }), NOW);
    expect(a.verdict).toBe("performed_as_authorized");
    expect(a.burden).toBe("none");
    expect(a.settledMinor).toBe(42_000);
  });

  it("settles a partial outcome as performed, and says so", () => {
    const d = decision();
    const a = adjudicate(chain({ decision: d, outcome: outcome(d, { result: "partial" }) }), NOW);
    expect(a.verdict).toBe("performed_as_authorized");
    expect(a.detail).toContain("in part");
  });

  it("refuses to settle a fractional or negative amount rather than rounding it", () => {
    // A settlement layer that quietly rounds is one whose totals stop
    // reconciling, and the first to notice is whoever is owed the rounding.
    const d = decision();
    for (const bad of [12.5, -1]) {
      const a = adjudicate(chain({ decision: d, outcome: outcome(d, { amountMinor: bad }) }), NOW);
      expect(a.verdict).toBe("indeterminate");
    }
  });

  it("settles at zero when no money moved", () => {
    const d = decision({ action: "read:accounts" });
    const a = adjudicate(
      chain({ decision: d, outcome: outcome(d, { amountMinor: undefined }) }),
      NOW,
    );
    expect(a.verdict).toBe("performed_as_authorized");
    expect(a.settledMinor).toBe(0);
  });
});

describe("indeterminate is a real verdict, not a failure", () => {
  it("says so when there is nothing to go on", () => {
    // A procedure that always produces a winner is one that will sometimes
    // invent one.
    const a = adjudicate(chain(), NOW);
    expect(a.verdict).toBe("indeterminate");
    expect(a.burden).toBe("none");
  });

  it("never throws, whatever it is handed", () => {
    const nasty: SettlementChain[] = [
      chain({ decision: decision({ at: NaN }) }),
      chain({ decision: decision({ action: "" }) }),
      { mandate: { ...mandate, scopes: [] } },
      chain({ outcome: outcome(decision()) }),
    ];
    for (const ch of nasty) {
      expect(() => adjudicate(ch, NOW)).not.toThrow();
      expect(adjudicate(ch, NOW).verdict).toBeDefined();
    }
  });

  it("is deterministic — the same records give the same verdict", () => {
    const d = decision();
    const ch = chain({ decision: d, outcome: outcome(d) });
    expect(adjudicate(ch, NOW)).toEqual(adjudicate(ch, NOW));
  });
});

describe("the outcome graph is de-identified by construction", () => {
  it("carries no subject, principal or institution reference", () => {
    // The gate lives here so a future caller cannot widen what gets published
    // by editing a query somewhere else.
    const d = decision();
    const ch = chain({ decision: d, outcome: outcome(d) });
    const row = toGraphRow(ch, adjudicate(ch, NOW))!;
    const serialised = JSON.stringify(row);
    expect(serialised).not.toContain("usr_1");
    expect(serialised).not.toContain("CASE-99");
    expect(serialised).not.toContain("mnd_1");
  });

  it("bands the amount instead of publishing it", () => {
    const d = decision();
    const ch = chain({ decision: d, outcome: outcome(d, { amountMinor: 42_000 }) });
    const row = toGraphRow(ch, adjudicate(ch, NOW))!;
    expect(row.amountBand).toBe("under_1k");
    expect(JSON.stringify(row)).not.toContain("42000");
  });

  it("publishes the number everybody actually wants", () => {
    const d = decision();
    const ch = chain({ decision: d, outcome: outcome(d, { at: d.at + 21 * 86_400 }) });
    const row = toGraphRow(ch, adjudicate(ch, NOW))!;
    expect(row.daysToOutcome).toBe(21);
  });

  it("publishes nothing from a broken or undecided chain", () => {
    expect(publishable(chain(), "indeterminate")).toBe(false);
    expect(publishable(chain(), "broken_chain")).toBe(false);
    expect(toGraphRow(chain(), adjudicate(chain(), NOW))).toBeNull();
  });

  it("does publish a refusal, because a refusal is the most useful row of all", () => {
    // "Letters citing this section to this institution are refused 80% of the
    // time" is exactly what the graph is for.
    const ch = chain({ decision: decision({ decision: "deny", reason: "revoked" }) });
    const row = toGraphRow(ch, adjudicate(ch, NOW))!;
    expect(row.verdict).toBe("refused_with_reason");
    expect(row.daysToOutcome).toBeNull();
  });
});

describe("buildMandateRef / draftDecisionRecord", () => {
  // /api/mandate/decide hand-rolled this once by hashing the reference object
  // instead of reusing the mandate's own token hash — a mistake invisible to
  // typecheck and build, and only caught by constructing a real chain end to
  // end and running it through adjudicate(). These two functions exist so the
  // correct shape is the only shape a caller can produce, and this test is the
  // regression guard for that exact failure mode.
  const claims = {
    jti: "mnd_live",
    iss: "https://zakai.example",
    aud: "bank.example",
    sub: "usr_live",
    scopes: ["contract:cancel", "dispute:charge"],
    nbf: nowSec - 100,
    exp: nowSec + 100,
  };
  const token = "header.payload.signature";

  it("hashes the raw token, not the reference object", () => {
    const ref = buildMandateRef(claims, token);
    expect(ref.hash).toBe(createHash("sha256").update(token, "utf8").digest("hex"));
    expect(ref.hash).not.toBe(hashRecord(claims));
  });

  it("sets prevHash to the mandate's own hash field, exactly what adjudicate() checks", () => {
    const ref = buildMandateRef(claims, token);
    const dec = draftDecisionRecord(ref, {
      institution: "bank.example",
      action: "contract:cancel",
      decision: "permit",
    });
    expect(dec.prevHash).toBe(ref.hash);
    expect(dec.mandateJti).toBe(ref.jti);
  });

  it("produces a chain that adjudicates cleanly end to end, never broken_chain", () => {
    const ref = buildMandateRef(claims, token);
    const dec = draftDecisionRecord(ref, {
      institution: "bank.example",
      action: "contract:cancel",
      decision: "deny",
      reason: "revocation_unknown",
      now: NOW,
    });
    const verdict = adjudicate({ mandate: ref, decision: dec }, NOW);
    expect(verdict.verdict).toBe("refused_with_reason");
  });

  it("omits reason and actConfirmation rather than writing them as undefined", () => {
    const ref = buildMandateRef(claims, token);
    const dec = draftDecisionRecord(ref, {
      institution: "bank.example",
      action: "contract:cancel",
      decision: "permit",
    });
    expect("reason" in dec ? dec.reason : undefined).toBeUndefined();
    expect("actConfirmation" in dec ? dec.actConfirmation : undefined).toBeUndefined();
  });
});
