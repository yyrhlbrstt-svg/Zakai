import { describe, expect, it } from "vitest";
import { createHash } from "crypto";
import {
  adjudicate,
  buildMandateRef,
  draftDecisionRecord,
  hashRecord,
  type DecisionRecord,
  type MandateRef,
} from "../src/settlement.js";

const NOW = new Date("2026-07-29T12:00:00Z");
const nowSec = Math.floor(NOW.getTime() / 1000);

describe("buildMandateRef / draftDecisionRecord", () => {
  const claims = {
    jti: "mnd_1",
    iss: "https://zakai.example",
    aud: "bank.example",
    sub: "usr_1",
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

  it("sets prevHash to the mandate's own hash field — the exact thing adjudicate() checks", () => {
    const ref = buildMandateRef(claims, token);
    const dec = draftDecisionRecord(ref, { institution: "bank.example", action: "contract:cancel", decision: "permit" });
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
});

describe("adjudicate", () => {
  const mandate: MandateRef = {
    jti: "mnd_1",
    iss: "https://zakai.example",
    aud: "bank.example",
    sub: "usr_1",
    scopes: ["dispute:charge"],
    nbf: nowSec - 10_000,
    exp: nowSec + 10_000,
    hash: "a".repeat(64),
  };

  function decision(over: Partial<DecisionRecord> = {}): DecisionRecord {
    return {
      id: "dec_1",
      institution: "bank.example",
      mandateJti: mandate.jti,
      prevHash: mandate.hash,
      action: "dispute:charge",
      decision: "permit",
      at: nowSec,
      ...over,
    };
  }

  it("is indeterminate with no decision at all", () => {
    expect(adjudicate({ mandate }, NOW).verdict).toBe("indeterminate");
  });

  it("flags a decision that names a different mandate as broken_chain", () => {
    const d = decision({ mandateJti: "some_other_mnd" });
    expect(adjudicate({ mandate, decision: d }, NOW).verdict).toBe("broken_chain");
  });

  it("flags a decision whose prevHash does not match the mandate as broken_chain", () => {
    const d = decision({ prevHash: "wrong-hash" });
    expect(adjudicate({ mandate, decision: d }, NOW).verdict).toBe("broken_chain");
  });

  it("permitted with no outcome yet puts the burden on the institution", () => {
    const verdict = adjudicate({ mandate, decision: decision() }, NOW);
    expect(verdict.verdict).toBe("authorized_not_performed");
    expect(verdict.burden).toBe("institution");
  });

  it("a denial is a refusal, not a fault", () => {
    const verdict = adjudicate({ mandate, decision: decision({ decision: "deny", reason: "revoked" }) }, NOW);
    expect(verdict.verdict).toBe("refused_with_reason");
    expect(verdict.burden).toBe("none");
  });
});
