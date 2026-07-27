import { describe, expect, it } from "vitest";
import { buildClaimDraft, requiredFields, resolveAction, toolRoute } from "./claimDraft";
import { RIGHT_ACTIONS } from "./rightsActions";
import { ENTITLEMENTS } from "./rights";

describe("every Israeli entitlement resolves to something real", () => {
  it("has an action — no right ends in a dead end", () => {
    const missing = ENTITLEMENTS.filter((e) => !resolveAction(e.id)).map((e) => e.id);
    expect(missing).toEqual([]);
  });

  it("either opens an in-app tool or produces a letter", () => {
    for (const e of ENTITLEMENTS) {
      const action = resolveAction(e.id)!;
      const usable = (action.kind === "tool" && Boolean(action.tool)) || action.drafts;
      expect({ id: e.id, usable }).toEqual({ id: e.id, usable: true });
    }
  });

  it("never routes anywhere outside the app", () => {
    for (const e of ENTITLEMENTS) {
      const route = toolRoute(e.id);
      if (!route) continue;
      expect(route.startsWith("/")).toBe(true);
      expect(route.startsWith("//")).toBe(false);
    }
  });

  it("contains no external link in any letter", () => {
    for (const [id, action] of Object.entries(RIGHT_ACTIONS)) {
      const text = `${action.subject ?? ""} ${action.body ?? ""}`;
      expect({ id, external: /https?:\/\//i.test(text) }).toEqual({ id, external: false });
    }
  });
});

describe("the document", () => {
  it("addresses the right body and includes a signature block", () => {
    const draft = buildClaimDraft("arnona_senior", {
      name: "דנה כהן",
      id: "012345678",
      municipality: "חיפה",
    })!;
    expect(draft.body).toContain("לכבוד");
    expect(draft.body).toContain("חיפה");
    expect(draft.body).toContain("דנה כהן");
    expect(draft.body).toContain("012345678");
    expect(draft.body).toContain("בכבוד רב");
    expect(draft.subject).toContain("ארנונה");
  });

  it("shows a missing value as a visible blank instead of dropping it", () => {
    const draft = buildClaimDraft("arnona_senior", { name: "דנה כהן" })!;
    // The municipality was never supplied; it must be obvious, not silent.
    expect(draft.body).toContain("____");
  });

  it("trims whitespace-only input rather than embedding it", () => {
    const draft = buildClaimDraft("arnona_senior", { name: "   ", id: "1", municipality: "  חיפה " })!;
    expect(draft.body).toContain("חיפה");
    expect(draft.body).toContain("____");
  });

  it("returns null for a tool-backed right so an empty letter can't be rendered", () => {
    expect(buildClaimDraft("mobile_check", { name: "x" })).toBeNull();
    expect(toolRoute("mobile_check")).toBe("/check");
  });

  it("returns null for an unknown right", () => {
    expect(buildClaimDraft("no_such_right", {})).toBeNull();
    expect(resolveAction("no_such_right")).toBeNull();
  });

  it("asks only for the fields that right actually needs", () => {
    expect(requiredFields("arnona_senior")).toEqual(["municipality"]);
    expect(requiredFields("tax_disability_exemption")).toEqual([]);
    expect(requiredFields("bank_basic_track")).toEqual(["counterparty", "accountNumber"]);
  });

  it("leaves no unfilled placeholder when every field is supplied", () => {
    for (const e of ENTITLEMENTS) {
      const action = resolveAction(e.id)!;
      if (!action.drafts) continue;
      const fields = Object.fromEntries(action.fields.map((f) => [f, `V-${f}`]));
      const draft = buildClaimDraft(e.id, { name: "א", id: "1", ...fields })!;
      expect({ id: e.id, leftover: /\{\w+\}/.test(draft.body + draft.subject) }).toEqual({
        id: e.id,
        leftover: false,
      });
      expect({ id: e.id, blank: draft.body.includes("____") }).toEqual({ id: e.id, blank: false });
    }
  });
});
