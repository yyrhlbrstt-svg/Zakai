import { describe, expect, it } from "vitest";
import { shouldNotifyInbound } from "./inboundDecision";

describe("shouldNotifyInbound", () => {
  it("notifies on a code match even at deterministic-fallback confidence (0.55)", () => {
    // The exact regression this module exists to prevent: without an AI key
    // the deterministic extractor tops out at 0.55, and the old inline
    // `confidence >= 0.6` gate meant a provider reply carrying the exact
    // ZK- code and an explicit amount never notified anyone.
    expect(
      shouldNotifyInbound({
        matchMethod: "code",
        found: true,
        newAmountShekels: 69,
        confidence: 0.55,
      }),
    ).toBe(true);
  });

  it("notifies on a code match regardless of confidence", () => {
    expect(
      shouldNotifyInbound({
        matchMethod: "code",
        found: true,
        newAmountShekels: 120,
        confidence: 0,
      }),
    ).toBe(true);
  });

  it("treats a reduction to zero (cancelled charge) as actionable", () => {
    expect(
      shouldNotifyInbound({
        matchMethod: "code",
        found: true,
        newAmountShekels: 0,
        confidence: 0.55,
      }),
    ).toBe(true);
  });

  it("never notifies without an extracted amount — nothing to confirm", () => {
    expect(
      shouldNotifyInbound({
        matchMethod: "code",
        found: true,
        newAmountShekels: null,
        confidence: 0.95,
      }),
    ).toBe(false);
  });

  it("never notifies when the extractor found no signal", () => {
    expect(
      shouldNotifyInbound({
        matchMethod: "code",
        found: false,
        newAmountShekels: 50,
        confidence: 0.9,
      }),
    ).toBe(false);
  });

  it("requires high confidence for fuzzy email-only matches", () => {
    expect(
      shouldNotifyInbound({
        matchMethod: "email",
        found: true,
        newAmountShekels: 69,
        confidence: 0.55,
      }),
    ).toBe(false);
    expect(
      shouldNotifyInbound({
        matchMethod: "email",
        found: true,
        newAmountShekels: 69,
        confidence: 0.6,
      }),
    ).toBe(true);
  });

  it("never notifies without any case match", () => {
    expect(
      shouldNotifyInbound({
        matchMethod: null,
        found: true,
        newAmountShekels: 69,
        confidence: 1,
      }),
    ).toBe(false);
  });

  it("rejects negative amounts", () => {
    expect(
      shouldNotifyInbound({
        matchMethod: "code",
        found: true,
        newAmountShekels: -5,
        confidence: 0.9,
      }),
    ).toBe(false);
  });
});
