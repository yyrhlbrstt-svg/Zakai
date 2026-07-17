/**
 * Flight disruption rights — Zakai's third vertical, and the on-brand way
 * into "flights": not a travel agency, but money the law already owes you.
 *
 * Based on Israel's Aviation Services Law (חוק שירותי תעופה — פיצוי וסיוע
 * בשל ביטול טיסה או שינוי בתנאיה, התשע"ב-2012):
 *  - Assistance services (food, drink, communication) from a 2h delay.
 *  - From 5h: also a refund or an alternative flight.
 *  - From 8h delay, or a cancellation announced <14 days ahead: also fixed
 *    monetary compensation by flight distance.
 *  - Cancellation announced 14+ days ahead: no monetary compensation.
 *
 * The statutory amounts are index-linked; the constants below are the 2023
 * published amounts and the UI says so. Airlines have narrow statutory
 * exemptions (e.g. extraordinary circumstances) — the UI discloses this and
 * nothing here is legal advice. Deterministic and fully tested.
 */

export type DistanceTier = "short" | "medium" | "long"; // ≤2,000 / 2,000–4,500 / >4,500 km

/** 2023 statutory amounts in agorot (index-linked; exact figure set at claim time). */
export const COMPENSATION_AGOROT: Record<DistanceTier, number> = {
  short: 149_000, // ₪1,490
  medium: 239_000, // ₪2,390
  long: 358_000, // ₪3,580
};

export type Disruption =
  | { kind: "cancelled"; noticeDaysAhead: number; tier: DistanceTier }
  | { kind: "delay"; delayHours: number; tier: DistanceTier };

export interface FlightEntitlement {
  /** Food, drink, communication (and lodging when relevant). */
  assistance: boolean;
  /** Refund of the ticket or an alternative flight. */
  refundOrAlternative: boolean;
  /** Fixed statutory compensation in agorot (0 when not owed). */
  compensationAgorot: number;
  /** i18n keys under flights.notes.* to display with the result. */
  noteKeys: string[];
}

export function computeEntitlement(d: Disruption): FlightEntitlement {
  if (d.kind === "cancelled") {
    if (d.noticeDaysAhead >= 14) {
      return {
        assistance: false,
        refundOrAlternative: true,
        compensationAgorot: 0,
        noteKeys: ["noticeExempt"],
      };
    }
    return {
      assistance: true,
      refundOrAlternative: true,
      compensationAgorot: COMPENSATION_AGOROT[d.tier],
      noteKeys: ["exceptions", "indexed"],
    };
  }

  const h = Math.max(0, d.delayHours);
  if (h < 2) {
    return { assistance: false, refundOrAlternative: false, compensationAgorot: 0, noteKeys: ["shortDelay"] };
  }
  if (h < 5) {
    return { assistance: true, refundOrAlternative: false, compensationAgorot: 0, noteKeys: ["exceptions"] };
  }
  if (h < 8) {
    return { assistance: true, refundOrAlternative: true, compensationAgorot: 0, noteKeys: ["exceptions"] };
  }
  // 8h+ delay is treated by the law like a cancellation.
  return {
    assistance: true,
    refundOrAlternative: true,
    compensationAgorot: COMPENSATION_AGOROT[d.tier],
    noteKeys: ["longDelayAsCancellation", "exceptions", "indexed"],
  };
}
