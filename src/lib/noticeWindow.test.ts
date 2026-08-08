import { describe, expect, it } from "vitest";
import {
  CLOSING_SOON_DAYS,
  atRiskAnnualAgorot,
  computeNoticeWindow,
  needsAttention,
  type NoticeWindow,
} from "./noticeWindow";

const NOW = new Date("2026-08-08T00:00:00");
const iso = (d: Date) => d.toISOString().slice(0, 10);
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe("computeNoticeWindow", () => {
  /**
   * The whole point. The contract says 1 January; the date that decides
   * whether you pay for another year is 2 November, and it appears nowhere.
   */
  it("derives the act-by date, not the renewal date", () => {
    const w = computeNoticeWindow({ renewalDate: "2027-01-01", noticeDays: 60, now: NOW });
    expect(iso(w.actBy!)).toBe("2026-11-02");
    expect(iso(w.renewsOn!)).toBe("2027-01-01");
  });

  it("counts the days that are actually left to act", () => {
    const w = computeNoticeWindow({ renewalDate: iso(inDays(90)), noticeDays: 30, now: NOW });
    expect(w.daysLeft).toBe(60);
    expect(w.state).toBe("open");
  });

  it("turns urgent inside the closing threshold", () => {
    const w = computeNoticeWindow({
      renewalDate: iso(inDays(30 + CLOSING_SOON_DAYS)),
      noticeDays: 30,
      now: NOW,
    });
    expect(w.daysLeft).toBe(CLOSING_SOON_DAYS);
    expect(w.state).toBe("closing");
  });

  it("says missed once the window has passed, even though renewal is still ahead", () => {
    // Renews in 10 days, needs 30 days' notice: nothing can be done about
    // this term now, and pretending otherwise helps nobody.
    const w = computeNoticeWindow({ renewalDate: iso(inDays(10)), noticeDays: 30, now: NOW });
    expect(w.state).toBe("missed");
    expect(w.daysLeft).toBeLessThan(0);
  });

  it("treats the last possible day as still open", () => {
    const w = computeNoticeWindow({ renewalDate: iso(inDays(30)), noticeDays: 30, now: NOW });
    expect(w.daysLeft).toBe(0);
    expect(w.state).toBe("closing");
  });

  /**
   * A confidently wrong "act by" date is worse than none: someone relaxes and
   * the term rolls. Being unable to say is a real answer.
   */
  it("refuses to guess a notice period that was not in the document", () => {
    const w = computeNoticeWindow({ renewalDate: "2027-01-01", noticeDays: null, now: NOW });
    expect(w.state).toBe("unknown");
    expect(w.actBy).toBeNull();
    expect(w.daysLeft).toBeNull();
  });

  it("refuses to guess a renewal date that was not in the document", () => {
    const w = computeNoticeWindow({ renewalDate: null, noticeDays: 60, now: NOW });
    expect(w.state).toBe("unknown");
    expect(w.actBy).toBeNull();
  });

  it("handles a contract with no notice period at all", () => {
    // Zero notice is a real term, not a missing one: you may cancel up to the
    // renewal date itself.
    const w = computeNoticeWindow({ renewalDate: iso(inDays(5)), noticeDays: 0, now: NOW });
    expect(w.state).toBe("closing");
    expect(w.daysLeft).toBe(5);
  });

  it("rejects a malformed date instead of producing an invalid one", () => {
    for (const bad of ["01/01/2027", "2027-13-01x", "soon", ""]) {
      expect(computeNoticeWindow({ renewalDate: bad, noticeDays: 30, now: NOW }).state).toBe(
        "unknown",
      );
    }
  });
});

describe("needsAttention", () => {
  const item = (renewalIn: number, noticeDays: number, monthlyAgorot = 10_000) => ({
    window: computeNoticeWindow({ renewalDate: iso(inDays(renewalIn)), noticeDays, now: NOW }),
    monthlyAgorot,
  });

  it("surfaces closing and missed, soonest first", () => {
    const missed = item(10, 30);
    const closing = item(35, 30);
    const open = item(300, 30);
    const out = needsAttention([open, closing, missed]);
    expect(out).toEqual([missed, closing]);
  });

  it("includes missed rather than filtering it away", () => {
    // A passed deadline is the most important thing on the list — the person
    // still has to decide what to do about a term that is now rolling.
    expect(needsAttention([item(10, 30)])).toHaveLength(1);
  });

  it("is empty when nothing is urgent", () => {
    expect(needsAttention([item(300, 30)])).toEqual([]);
  });

  it("ignores windows it could not compute", () => {
    const unknown = {
      window: computeNoticeWindow({ renewalDate: null, noticeDays: null, now: NOW }),
      monthlyAgorot: 10_000,
    };
    expect(needsAttention([unknown])).toEqual([]);
  });
});

describe("atRiskAnnualAgorot", () => {
  const at = (state: NoticeWindow["state"], monthlyAgorot: number) => ({
    window:
      state === "missed"
        ? computeNoticeWindow({ renewalDate: iso(inDays(1)), noticeDays: 30, now: NOW })
        : computeNoticeWindow({ renewalDate: iso(inDays(300)), noticeDays: 30, now: NOW }),
    monthlyAgorot,
  });

  it("values what can still be saved over a year", () => {
    expect(atRiskAnnualAgorot([at("open", 10_000)])).toBe(120_000);
  });

  it("excludes what is already locked in, which is no longer at risk", () => {
    expect(atRiskAnnualAgorot([at("missed", 10_000)])).toBe(0);
  });

  it("keeps money in integer agorot", () => {
    const total = atRiskAnnualAgorot([at("open", 1_234.6)]);
    expect(Number.isInteger(total)).toBe(true);
  });

  it("is zero for an empty list", () => {
    expect(atRiskAnnualAgorot([])).toBe(0);
  });
});
