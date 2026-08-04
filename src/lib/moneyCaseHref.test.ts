import { describe, expect, it } from "vitest";
import { moneyCaseHref } from "./moneyCaseHref";

describe("moneyCaseHref", () => {
  it("adds sent=1 only when delivered", () => {
    expect(moneyCaseHref("c1", { delivered: true })).toBe("/money?case=c1&sent=1");
    expect(moneyCaseHref("c1", { delivered: false })).toBe("/money?case=c1");
    expect(moneyCaseHref("c1")).toBe("/money?case=c1");
  });
});
