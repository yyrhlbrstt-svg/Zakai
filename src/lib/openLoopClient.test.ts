import { describe, expect, it, vi } from "vitest";
import { hasOutreachEmail, redirectIfOpenLoop } from "./openLoopClient";

describe("hasOutreachEmail", () => {
  it("accepts a minimal inbox", () => {
    expect(hasOutreachEmail("a@b.co")).toBe(true);
  });

  it("rejects empty and non-emails", () => {
    expect(hasOutreachEmail("")).toBe(false);
    expect(hasOutreachEmail("  ")).toBe(false);
    expect(hasOutreachEmail("nope")).toBe(false);
    expect(hasOutreachEmail(null)).toBe(false);
  });
});

describe("redirectIfOpenLoop", () => {
  it("redirects on OPEN_LOOP with nextHref", () => {
    const push = vi.fn();
    expect(redirectIfOpenLoop({ error: "OPEN_LOOP", nextHref: "/money?case=c1" }, push)).toBe(true);
    expect(push).toHaveBeenCalledWith("/money?case=c1");
  });

  it("ignores other errors", () => {
    const push = vi.fn();
    expect(redirectIfOpenLoop({ error: "caseLimit" }, push)).toBe(false);
    expect(redirectIfOpenLoop({ error: "OPEN_LOOP" }, push)).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
});
