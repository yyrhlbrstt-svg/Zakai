import { describe, expect, it } from "vitest";
import { buildFollowUpForVertical } from "./followUpRouter";

const base = {
  customerName: "דנה",
  providerLabel: "בדיקה",
  amountOriginalShekels: 200,
  targetShekels: 0,
  replyKind: "delay" as const,
  round: 2,
};

describe("buildFollowUpForVertical", () => {
  it("uses airline language for airline", () => {
    const r = buildFollowUpForVertical("airline", base);
    expect(r.body).toMatch(/פיצוי|טיסה/);
    expect(r.body).not.toMatch(/לחודש/);
  });

  it("uses lump language for bank-fees / cancel", () => {
    const r = buildFollowUpForVertical("bank-fees", base);
    expect(r.body).toMatch(/החזר|סיום|דרישה/);
    expect(r.subject).not.toMatch(/שימור לקוח/);
  });

  it("keeps telecom monthly language for telecom", () => {
    const r = buildFollowUpForVertical("telecom", {
      ...base,
      targetShekels: 80,
      replyKind: "refused",
    });
    expect(r.body).toMatch(/לחודש|שימור/);
  });
});
