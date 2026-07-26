import { describe, it, expect } from "vitest";
import { deterministicIntent, type AssistantIntent } from "./ai";

describe("deterministicIntent", () => {
  const cases: Array<[string, AssistantIntent]> = [
    ["בדוק לי חשבון סלולר", "new_check"],
    ["אני רוצה לבדוק חשמל", "show_electricity"],
    ["מה הסטטוס של התיקים שלי", "show_dashboard"],
    ["כמה עולה המנוי", "show_pricing"],
    ["מנויים שאפשר לבטל", "show_scan"],
    ["מה מגיע לי מהמדינה", "show_rights"],
    ["בדיקת תלוש משכורת", "show_payslip"],
    ["תגמולי מילואים", "show_miluim"],
    ["פיצוי על טיסה", "show_flights"],
    ["השוואת ספקי חשמל", "show_electricity"],
    ["החזר מס", "show_tax_refund"],
    ["דמי אבטלה", "show_unemployment"],
    ["פיצויי פיטורים", "show_severance"],
    ["דמי לידה", "show_maternity"],
    ["שלום", "chat"],
  ];

  it.each(cases)("classifies '%s' as %s", (text, intent) => {
    expect(deterministicIntent(text).intent).toBe(intent);
  });

  it("falls back to chat for unknown text", () => {
    expect(deterministicIntent("xyz123").intent).toBe("chat");
  });
});
