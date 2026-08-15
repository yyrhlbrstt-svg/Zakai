import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The path that works must not hide behind the path that cannot.
 *
 * With no SMTP configured — the state production has actually been in — "send
 * via Zakai" writes an Outbox row that stays QUEUED forever. The reader
 * believes a letter went out and nothing ever leaves. Meanwhile the route that
 * genuinely reaches a provider, copy the letter and send it yourself, needs no
 * credential at all and worked the whole time.
 *
 * It was a ghost button, and in two places it was folded inside a collapsed
 * <details> — on /money labelled, literally, "alternatives (not the agent
 * path)". So the only route to somebody's money was styled as the lesser one
 * and hidden behind the one that does nothing. That is not a missing feature;
 * it is a working product made unreachable by its own hierarchy, and it is the
 * most likely reason people who tried this "couldn't do anything".
 *
 * These assertions hold the correction in place. They are deliberately about
 * STRUCTURE — that the emphasis is driven by real deliverability rather than
 * hardcoded — because the specific styling will change and the property must
 * not.
 */
const CHECK_FLOW = "src/components/CheckFlow.tsx";
const MONEY_HUB = "src/components/MoneyHub.tsx";
const CHECK_PAGE = "src/app/[locale]/check/page.tsx";
const MONEY_PAGE = "src/app/[locale]/money/page.tsx";

const read = (p: string) => readFileSync(p, "utf8");

describe("self-send emphasis follows real deliverability", () => {
  it("CheckFlow decides button emphasis from mailLive, not a constant", () => {
    const src = read(CHECK_FLOW);
    expect(src).toContain("mailLive");
    // The self-send button's variant must be conditional. A hardcoded "ghost"
    // here is exactly the bug: it pins the working path to secondary styling
    // regardless of whether the primary one can do anything.
    expect(/variant=\{mailLive \? "ghost" : "primary"\}/.test(src)).toBe(true);
    expect(/variant=\{mailLive \? "primary" : "ghost"\}/.test(src)).toBe(true);
  });

  it("MoneyHub does not bury the self-send route when mail is dead", () => {
    const src = read(MONEY_HUB);
    expect(src).toContain("mailLive");
    // The <details> wrapper is only acceptable while mail actually works.
    expect(/\{mailLive \? \(\s*<details/.test(src)).toBe(true);
  });

  it("both pages pass the real SMTP gate rather than assuming", () => {
    // A page that hardcoded mailLive={true} would satisfy every assertion
    // above while restoring the exact bug in production.
    for (const page of [CHECK_PAGE, MONEY_PAGE]) {
      const src = read(page);
      expect(src, `${page} must import the gate`).toContain("smtpFullyConfigured");
      expect(src, `${page} must pass it`).toMatch(/mailLive=\{smtpFullyConfigured\(\)\}/);
      expect(src, `${page} must not hardcode mailLive`).not.toMatch(/mailLive=\{true\}/);
    }
  });

  it("the self-send action still exists at all", () => {
    // Guards against a refactor that satisfies the structure checks by
    // deleting the working path instead of surfacing it.
    expect(read(CHECK_FLOW)).toContain("copyDraftForSelf");
    expect(read(MONEY_HUB)).toContain("/cancel/universal");
  });
});
