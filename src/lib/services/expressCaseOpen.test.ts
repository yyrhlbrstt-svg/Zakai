import { describe, expect, it } from "vitest";
import { expressOpenBody } from "./expressCaseOpen";

describe("expressOpenBody", () => {
  it("marks mandate_sent only when delivered", () => {
    const body = expressOpenBody({
      caseId: "c1",
      dispatched: true,
      delivered: true,
      extra: { subject: "x" },
    });
    expect(body.message).toBe("mandate_sent");
    expect(body.needsOutreachEmail).toBe(false);
    expect(body.subject).toBe("x");
  });

  it("marks case_opened when dispatched but not delivered (QUEUED / no SMTP)", () => {
    const body = expressOpenBody({
      caseId: "c1",
      dispatched: true,
      delivered: false,
    });
    expect(body.message).toBe("case_opened");
    expect(body.dispatched).toBe(true);
    expect(body.delivered).toBe(false);
  });

  it("marks case_opened when not dispatched", () => {
    const body = expressOpenBody({
      caseId: "c1",
      dispatched: false,
      delivered: false,
    });
    expect(body.message).toBe("case_opened");
    expect(body.dispatched).toBe(false);
  });
});
