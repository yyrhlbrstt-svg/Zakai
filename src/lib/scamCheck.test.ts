import { describe, expect, it } from "vitest";
import { assessMessage } from "./scamCheck";

describe("assessMessage", () => {
  it("flags the package/customs pattern — the most common Israeli SMS scam", () => {
    const result = assessMessage(
      "דואר ישראל: החבילה שלך עוכבה במכס, לתשלום אגרה לחץ כאן http://track-il.co",
    );
    expect(result.risk).toBe("high");
    expect(result.matches.some((m) => m.id === "package_customs")).toBe(true);
  });

  it("flags an unrequested lottery win with a link", () => {
    const result = assessMessage("מזל טוב! זכית בפרס של 10,000 ₪, לקבלת הזכייה: bit.ly/xyz123");
    expect(result.risk).toBe("high");
    expect(result.matches.some((m) => m.id === "lottery_prize")).toBe(true);
  });

  it("flags a bank/Bit impersonation asking for a verification code", () => {
    const result = assessMessage("הודעה מהבנק שלך: לצורך אימות הפעולה אנא הזן את קוד האימות שקיבלת");
    expect(result.risk).toBe("high");
    expect(result.matches.some((m) => m.id === "bank_verification")).toBe(true);
  });

  it("flags a government-refund link", () => {
    const result = assessMessage("רשות המסים: מגיע לך החזר מס, לקבלת הכסף היכנס ל-www.tax-refund-il.net");
    expect(result.risk).toBe("high");
    expect(result.matches.some((m) => m.id === "gov_refund")).toBe(true);
  });

  it("flags a shortened link with urgency language even without a named brand", () => {
    const result = assessMessage("החשבון שלך ייחסם תוך 24 שעות, לחידוש: tinyurl.com/abc");
    expect(result.risk).toBe("high");
    expect(result.matches.some((m) => m.id === "shortened_link_urgency")).toBe(true);
  });

  it("does not flag an ordinary message with no scam pattern", () => {
    const result = assessMessage("היי, מה שלומך? נדבר מחר לגבי הפגישה");
    expect(result.risk).toBe("unclear");
    expect(result.matches).toHaveLength(0);
  });

  it("does not flag a real delivery notification with no payment/link demand", () => {
    const result = assessMessage("החבילה שלך תגיע מחר בין 10:00-14:00");
    expect(result.risk).toBe("unclear");
  });

  it("never asserts safety — an empty match list is 'unclear', not a clean bill of health", () => {
    const result = assessMessage("שיחה רגילה לגמרי בלי שום דבר חשוד");
    expect(result.risk).not.toBe("safe" as unknown as string);
    expect(result.risk).toBe("unclear");
  });

  it("can match more than one pattern at once", () => {
    const result = assessMessage(
      "בנק לאומי: יש לאמת את הפעולה תוך 24 שעות, הזן קוד אימות וסיסמה כדי שהחשבון לא ייחסם",
    );
    expect(result.matches.length).toBeGreaterThanOrEqual(2);
  });
});
