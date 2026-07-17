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

/* ------------------------------------------------------------------ */
/* EU Regulation EC 261/2004 — flights departing the EU, or arriving   */
/* in the EU on an EU carrier. The relevant international right for    */
/* Israelis flying via Europe and for visitors from abroad.            */
/* ------------------------------------------------------------------ */

export type EuDistanceTier = "short" | "medium" | "long"; // ≤1,500 / 1,500–3,500 / >3,500 km

/** Fixed EC261 amounts in whole euros. */
export const EU_COMPENSATION_EUR: Record<EuDistanceTier, number> = {
  short: 250,
  medium: 400,
  long: 600,
};

export type EuDisruption =
  | { kind: "cancelled"; noticeDaysAhead: number; tier: EuDistanceTier }
  | { kind: "delay"; delayHours: number; tier: EuDistanceTier };

export interface EuFlightEntitlement {
  assistance: boolean;
  refundOrAlternative: boolean;
  compensationEur: number;
  noteKeys: string[];
}

/**
 * EC261 ladder: assistance from ~2h; fixed compensation from a 3h ARRIVAL
 * delay (Sturgeon doctrine) or a cancellation announced <14 days ahead;
 * refund/re-routing from 5h or on cancellation. Extraordinary-circumstances
 * exemptions disclosed via note keys.
 */
export function computeEntitlementEU(d: EuDisruption): EuFlightEntitlement {
  if (d.kind === "cancelled") {
    if (d.noticeDaysAhead >= 14) {
      return { assistance: false, refundOrAlternative: true, compensationEur: 0, noteKeys: ["noticeExempt"] };
    }
    return {
      assistance: true,
      refundOrAlternative: true,
      compensationEur: EU_COMPENSATION_EUR[d.tier],
      noteKeys: ["euExceptions"],
    };
  }
  const h = Math.max(0, d.delayHours);
  if (h < 2) {
    return { assistance: false, refundOrAlternative: false, compensationEur: 0, noteKeys: ["shortDelay"] };
  }
  if (h < 3) {
    return { assistance: true, refundOrAlternative: false, compensationEur: 0, noteKeys: ["euExceptions"] };
  }
  if (h < 5) {
    return {
      assistance: true,
      refundOrAlternative: false,
      compensationEur: EU_COMPENSATION_EUR[d.tier],
      noteKeys: ["eu3h", "euExceptions"],
    };
  }
  return {
    assistance: true,
    refundOrAlternative: true,
    compensationEur: EU_COMPENSATION_EUR[d.tier],
    noteKeys: ["eu3h", "euExceptions"],
  };
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
