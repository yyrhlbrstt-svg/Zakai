import { describe, expect, it } from "vitest";
import {
  DEFAULT_WINDOW_DAYS,
  actNowBefore,
  buildCommitmentWindow,
  byDay,
  worthShowing,
} from "./commitmentCalendar";
import type { RecurringCharge } from "./subscriptions";

const NOW = new Date("2026-08-07T00:00:00");
const d = (iso: string) => new Date(`${iso}T00:00:00`);

/** A charge seen monthly, last on `lastIso`. */
const monthly = (merchant: string, agorot: number, lastIso: string): RecurringCharge => {
  const last = d(lastIso);
  const prior = new Date(last.getTime() - 30 * 86_400_000);
  const earlier = new Date(last.getTime() - 60 * 86_400_000);
  return {
    merchant,
    category: "other",
    monthlyAgorot: agorot,
    occurrences: 3,
    providerKey: null, confidence: 1,
    chargedOn: [earlier, prior, last],
  };
};

/** A charge with erratic gaps, which must never be dated. */
const erratic = (merchant: string, agorot: number): RecurringCharge => ({
  merchant,
  category: "other",
  monthlyAgorot: agorot,
  occurrences: 3,
  providerKey: null, confidence: 1,
  chargedOn: [d("2026-06-01"), d("2026-06-04"), d("2026-07-05")],
});

describe("buildCommitmentWindow", () => {
  it("answers the question people actually have: what leaves, and when", () => {
    const w = buildCommitmentWindow(
      [monthly("סלקום", 8_990, "2026-07-20"), monthly("נטפליקס", 5_490, "2026-07-12")],
      { now: NOW },
    );
    expect(w.dated).toHaveLength(2);
    expect(w.datedAgorot).toBe(8_990 + 5_490);
    // Soonest first — Netflix lands on the 11th, Cellcom on the 19th.
    expect(w.nextUp?.merchant).toBe("נטפליקס");
  });

  /**
   * The property that makes a calendar trustworthy. A calendar people plan
   * against is worthless the first time it is confidently wrong, so a charge
   * with an unclear cadence gets no date at all.
   */
  it("never places an erratic charge on a guessed day", () => {
    const w = buildCommitmentWindow([erratic("ספק", 4_000)], { now: NOW });
    expect(w.dated).toHaveLength(0);
    expect(w.undated.map((e) => e.merchant)).toEqual(["ספק"]);
  });

  it("still counts undated charges, so the headline is not understated", () => {
    const w = buildCommitmentWindow(
      [monthly("סלקום", 8_990, "2026-07-20"), erratic("ספק", 4_000)],
      { now: NOW },
    );
    expect(w.datedAgorot).toBe(8_990);
    expect(w.undatedAgorot).toBe(4_000);
  });

  it("excludes charges that land beyond the window", () => {
    // Quarterly: next one is far outside 30 days.
    const quarterly: RecurringCharge = {
      merchant: "ביטוח",
      category: "other",
      monthlyAgorot: 30_000,
      occurrences: 3,
      providerKey: null, confidence: 1,
      chargedOn: [d("2026-01-05"), d("2026-04-05"), d("2026-07-05")],
    };
    const w = buildCommitmentWindow([quarterly], { now: NOW, days: 7 });
    expect(w.dated).toHaveLength(0);
  });

  it("honours a custom window", () => {
    const w = buildCommitmentWindow([monthly("סלקום", 8_990, "2026-07-20")], {
      now: NOW,
      days: 3,
    });
    expect(w.days).toBe(3);
    expect(w.dated).toHaveLength(0); // lands in ~12 days
  });

  it("keeps money in integer agorot", () => {
    const w = buildCommitmentWindow([monthly("ספק", 1_234.7 as number, "2026-07-20")], {
      now: NOW,
    });
    expect(Number.isInteger(w.datedAgorot)).toBe(true);
  });

  it("is empty and honest with no charges", () => {
    const w = buildCommitmentWindow([], { now: NOW });
    expect(w.dated).toEqual([]);
    expect(w.datedAgorot).toBe(0);
    expect(w.nextUp).toBeNull();
    expect(worthShowing(w)).toBe(false);
  });

  it("defaults to a month, which is what people budget against", () => {
    expect(buildCommitmentWindow([], {}).days).toBe(DEFAULT_WINDOW_DAYS);
  });
});

describe("actNowBefore", () => {
  it("names only what can still be stopped in time", () => {
    const w = buildCommitmentWindow(
      [monthly("נטפליקס", 5_490, "2026-07-12"), monthly("סלקום", 8_990, "2026-07-20")],
      { now: NOW },
    );
    // Netflix ~4 days out, Cellcom ~12.
    const urgent = actNowBefore(w, 7);
    expect(urgent.map((e) => e.merchant)).toEqual(["נטפליקס"]);
  });

  it("is empty when nothing is imminent", () => {
    const w = buildCommitmentWindow([monthly("סלקום", 8_990, "2026-07-20")], { now: NOW });
    expect(actNowBefore(w, 2)).toEqual([]);
  });
});

describe("byDay", () => {
  it("groups charges that land on the same day", () => {
    const w = buildCommitmentWindow(
      [monthly("א", 1_000, "2026-07-12"), monthly("ב", 2_000, "2026-07-12")],
      { now: NOW },
    );
    const groups = byDay(w);
    expect(groups).toHaveLength(1);
    expect(groups[0].entries).toHaveLength(2);
  });

  it("omits days with nothing due, so the dates that matter stand out", () => {
    const w = buildCommitmentWindow(
      [monthly("א", 1_000, "2026-07-12"), monthly("ב", 2_000, "2026-07-20")],
      { now: NOW },
    );
    const groups = byDay(w);
    expect(groups).toHaveLength(2);
    expect(groups[0].daysUntil).toBeLessThan(groups[1].daysUntil);
  });

  it("is empty for an empty window", () => {
    expect(byDay(buildCommitmentWindow([], { now: NOW }))).toEqual([]);
  });
});
