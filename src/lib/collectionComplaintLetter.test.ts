import { describe, expect, it } from "vitest";
import { buildCollectionComplaintLetter } from "./collectionComplaintLetter";

describe("buildCollectionComplaintLetter", () => {
  it("cites the Consumer Protection Law and never admits or cancels the debt", () => {
    const letter = buildCollectionComplaintLetter({
      customerName: "אלון",
      collectorName: "חברת גבייה בע\"מ",
      reason: "disputed_amount",
      claimedAmountShekels: 1200,
    });
    expect(letter.body).toContain("חוק הגנת הצרכן, התשמ\"א-1981");
    expect(letter.body).toContain("אינה הודאה בחוב");
    expect(letter.body).toContain("₪1200.00");
  });

  it("uses the harassment reason text for that reason", () => {
    const letter = buildCollectionComplaintLetter({
      customerName: "נעם",
      collectorName: "",
      reason: "harassment",
    });
    expect(letter.body).toContain("שיחות וטלפונים חוזרים");
    expect(letter.body).not.toContain("₪");
  });

  it("produces a non-empty body for every reason category", () => {
    const reasons = ["harassment", "no_written_notice", "disputed_amount", "other"] as const;
    for (const reason of reasons) {
      const letter = buildCollectionComplaintLetter({
        customerName: "דנה",
        collectorName: "גובה",
        reason,
      });
      expect(letter.body.length).toBeGreaterThan(0);
    }
  });

  it("falls back to placeholder names rather than empty strings", () => {
    const letter = buildCollectionComplaintLetter({
      customerName: "",
      collectorName: "",
      reason: "other",
    });
    expect(letter.body).toContain("הלקוח/ה");
    expect(letter.body).toContain("חברת הגבייה");
  });
});
