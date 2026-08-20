import { describe, expect, it } from "vitest";
import {
  buildRightsListing,
  buildRightsManifest,
  collectTriggerFields,
  evaluateFacts,
} from "./publicSurface";
import { RIGHTS, getRight, verifiedRights } from "./registry";

const ORIGIN = "https://zakai.test";

describe("public surface — draft law is invisible outside", () => {
  it("the listing serves only verified rights", () => {
    const listing = buildRightsListing(ORIGIN);
    expect(listing.rights.length).toBe(verifiedRights().length);
    const ids = listing.rights.map((r) => (r as { id: string }).id);
    expect(ids).toContain("il.consumer.31a.continued-billing-after-cancellation");
    expect(ids).not.toContain("il.banking.tax.credit-points-unused");
  });

  it("the manifest counts drafts without exposing their content", () => {
    const manifest = buildRightsManifest(ORIGIN);
    expect(manifest.counts.verified).toBe(verifiedRights().length);
    expect(manifest.counts.draft_pending_verification).toBe(
      RIGHTS.length - verifiedRights().length,
    );
    // No draft id or title anywhere in the serialized manifest.
    const serialized = JSON.stringify(manifest);
    expect(serialized).not.toContain("credit-points-unused");
    expect(serialized).not.toContain("נקודות זיכוי");
  });

  it("evaluate never returns a draft right, even with qualifying facts", () => {
    const result = evaluateFacts(ORIGIN, { employed_last_6_years: true });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("credit-points-unused");
  });
});

describe("public surface — every served right is independently verifiable", () => {
  it("each right carries its statute with sourceUrl and lastVerifiedAt", () => {
    for (const r of buildRightsListing(ORIGIN).rights as {
      statute: { sourceUrl: string; lastVerifiedAt: string };
    }[]) {
      expect(r.statute.sourceUrl).toMatch(/^https:\/\//);
      expect(r.statute.lastVerifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("each right points at how to act — the Mandate — not just what is owed", () => {
    for (const r of buildRightsListing(ORIGIN).rights as {
      act: { mandate_spec: string; handoff: string };
    }[]) {
      expect(r.act.mandate_spec).toBe(`${ORIGIN}/.well-known/zakai-mandate.json`);
      expect(r.act.handoff).toBe(`${ORIGIN}/api/pipe/handoff`);
    }
  });
});

describe("evaluateFacts", () => {
  const qualifying = {
    continuing_transaction: true,
    written_cancellation_sent: true,
    charged_after_cancellation: true,
  };

  it("returns the 31a right with its statutory cap when the facts hold", () => {
    const result = evaluateFacts(ORIGIN, qualifying);
    const hit = (result.applicable as { id: string; computed_remedy_minor?: number }[]).find(
      (r) => r.id === "il.consumer.31a.continued-billing-after-cancellation",
    );
    expect(hit).toBeDefined();
    // No formula on this right → the computed remedy is the statutory cap.
    expect(hit!.computed_remedy_minor).toBe(1_000_000);
  });

  it("names the missing facts instead of guessing when facts are absent", () => {
    const result = evaluateFacts(ORIGIN, { continuing_transaction: true });
    expect(result.applicable).toHaveLength(0);
    const pending = result.not_yet_decidable.find(
      (r) => r.id === "il.consumer.31a.continued-billing-after-cancellation",
    );
    expect(pending).toBeDefined();
    expect(pending!.missing_facts).toEqual([
      "charged_after_cancellation",
      "written_cancellation_sent",
    ]);
  });

  it("does not apply the right when a fact is explicitly false — fail closed, and not listed as missing", () => {
    const result = evaluateFacts(ORIGIN, { ...qualifying, written_cancellation_sent: false });
    expect(result.applicable).toHaveLength(0);
    const pending = result.not_yet_decidable.find((r) =>
      r.id.includes("continued-billing"),
    );
    // All facts were supplied — the right simply does not apply; nothing to ask.
    expect(pending).toBeUndefined();
  });

  it("always carries the not-legal-advice disclaimer", () => {
    expect(evaluateFacts(ORIGIN, {}).disclaimer).toContain("not legal advice");
  });
});

describe("collectTriggerFields", () => {
  it("walks nested predicates and returns sorted unique fields", () => {
    const right = getRight("il.consumer.31a.continued-billing-after-cancellation")!;
    expect(collectTriggerFields(right)).toEqual([
      "charged_after_cancellation",
      "continuing_transaction",
      "written_cancellation_sent",
    ]);
  });
});
