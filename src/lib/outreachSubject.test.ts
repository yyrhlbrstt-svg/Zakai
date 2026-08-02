import { describe, expect, it } from "vitest";
import { outreachSubjectForVertical } from "./outreachSubject";

describe("outreachSubjectForVertical", () => {
  it("uses flight wording for airline", () => {
    expect(outreachSubjectForVertical("airline", "דנה", "ZK-1")).toContain("פיצוי טיסה");
  });

  it("uses telecom default for mobile", () => {
    expect(outreachSubjectForVertical("telecom", "דנה", "ZK-1")).toContain("התאמת מסלול");
    expect(outreachSubjectForVertical("subscription", "דנה", "ZK-1")).toContain("ביטול");
  });
});
