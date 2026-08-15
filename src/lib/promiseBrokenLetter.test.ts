import { describe, expect, it } from "vitest";
import { REPLY_KIND_OPTIONS, type FollowUpInput } from "./negotiation";
import { buildFollowUpForVertical } from "./followUpRouter";

/**
 * A broken promise is the strongest position a claimant ever has: the amount
 * is not in dispute, because the counterparty set it. The letter has to be
 * routed to a playbook that knows that.
 *
 * Every vertical playbook has a `default` branch that produces a polite
 * reminder. Falling into it here would quietly re-open a negotiation that was
 * already won — which is why this walks the real router across every family
 * rather than testing one builder.
 */
const input = (over: Partial<FollowUpInput> = {}): FollowUpInput => ({
  customerName: "דנה",
  providerLabel: "סלקום",
  amountOriginalShekels: 120,
  targetShekels: 90,
  replyKind: "promise_broken",
  promisedShekels: 3_000,
  observedShekels: 0,
  promisedOnLabel: "2026-03-12",
  ...over,
});

/** One vertical from each playbook family the router dispatches to. */
const VERTICALS = ["telecom", "deposit", "airline"] as const;

describe("every playbook holds them to the credit they agreed", () => {
  it.each(VERTICALS)("does not fall through to a generic reminder (%s)", (vertical) => {
    const out = buildFollowUpForVertical(vertical, input());
    expect(out.body).toContain("3,000".replace(",", "")); // ₪3000, no separator
    expect(out.body).toContain("התחייבות קיימת שטרם קוימה");
    // The generic reminders all lead with "תזכורת"; this letter must not.
    expect(out.subject).not.toContain("תזכורת");
  });

  it.each(VERTICALS)("never asks for a discount (%s)", (vertical) => {
    const out = buildFollowUpForVertical(vertical, input());
    // The target price belongs to a negotiation. Quoting it here invites them
    // to treat a settled amount as an opening bid.
    expect(out.body).not.toContain("90");
    expect(out.body).not.toContain("יעד");
  });
});

describe("the numbers come from what was recorded", () => {
  it("states the outstanding balance after a partial credit", () => {
    const out = buildFollowUpForVertical(
      "telecom",
      input({ promisedShekels: 3_000, observedShekels: 1_200 }),
    );
    expect(out.body).toContain("1200"); // credited
    expect(out.body).toContain("1800"); // still outstanding
    expect(out.subject).toContain("1800");
  });

  it("says plainly that nothing arrived when nothing did", () => {
    const out = buildFollowUpForVertical("telecom", input({ observedShekels: 0 }));
    expect(out.body).toContain("לא נמצא זיכוי");
  });

  it("never turns an overpayment into a demand", () => {
    // They credited more than promised. Asking for a negative balance would
    // invent a debt, and demanding "a date to credit ₪0" is absurd — so the
    // letter becomes a request to confirm the completed credit in writing.
    const out = buildFollowUpForVertical(
      "telecom",
      input({ promisedShekels: 1_000, observedShekels: 1_500 }),
    );
    expect(out.body).not.toMatch(/₪-|₪0\b/);
    expect(out.body).toContain("אותר בדפי החשבון");
  });

  it("asks for confirmation, not for money, when the full credit arrived", () => {
    const out = buildFollowUpForVertical(
      "telecom",
      input({ promisedShekels: 3_000, observedShekels: 3_000 }),
    );
    expect(out.body).toContain("אישור כתוב");
    expect(out.body).not.toContain("שטרם קוימה");
  });

  it("omits the date when the person did not record one", () => {
    const out = buildFollowUpForVertical("telecom", input({ promisedOnLabel: undefined }));
    expect(out.body).not.toContain("התחייבות מיום");
    expect(out.body).toContain("סוכם על זיכוי");
  });

  it("includes the date when they did", () => {
    const out = buildFollowUpForVertical("telecom", input({ promisedOnLabel: "2026-03-12" }));
    expect(out.body).toContain("התחייבות מיום 2026-03-12");
  });
});

describe("the option is offered to the user", () => {
  it("appears in the reply-kind list, or nothing can select it", () => {
    // The engines that were built and wired to nothing are the recurring
    // failure in this codebase; a letter no dropdown lists is another one.
    expect(REPLY_KIND_OPTIONS.map((o) => o.id)).toContain("promise_broken");
  });

  it("is labelled in both languages", () => {
    const opt = REPLY_KIND_OPTIONS.find((o) => o.id === "promise_broken")!;
    expect(opt.he.trim().length).toBeGreaterThan(0);
    expect(opt.en.trim().length).toBeGreaterThan(0);
  });
});
