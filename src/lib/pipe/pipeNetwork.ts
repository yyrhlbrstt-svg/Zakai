/**
 * De-identified pipe volume — the Visa scoreboard.
 * Empty totals are honest; filled totals are the only institutional marketing.
 */

export interface PipeNetworkVolume {
  mandatesIssued: number;
  casesSent: number;
  savingsProofs: number;
  verifiedRecoveredMinor: number;
}

export function scorePipeGravity(v: PipeNetworkVolume): {
  tier: "empty" | "signal" | "gravity" | "network";
  note: string;
  noteHe: string;
} {
  if (v.mandatesIssued === 0 && v.casesSent === 0 && v.savingsProofs === 0) {
    return {
      tier: "empty",
      note: "Rails are live; volume is zero — deploy SMTP and run real cases.",
      noteHe: "המסילות חיות; הנפח אפס — SMTP בפרוד ותיקים אמיתיים.",
    };
  }
  if (v.savingsProofs >= 50 && v.mandatesIssued >= 200) {
    return {
      tier: "network",
      note: "Enough documented outcomes that ignoring Mandate verify is operationally expensive.",
      noteHe: "יש מספיק תוצאות מתועדות — להתעלם מאימות Mandate כבר יקר תפעולית.",
    };
  }
  if (v.casesSent >= 20 || v.mandatesIssued >= 20) {
    return {
      tier: "gravity",
      note: "Outbound Mandate volume is accumulating — desks will start noticing.",
      noteHe: "נפח Mandate יוצא מצטבר — שולחנות יתחילו להבחין.",
    };
  }
  return {
    tier: "signal",
    note: "First real Mandates/SENT cases exist — keep pushing IL loop volume.",
    noteHe: "יש Mandates/SENT ראשונים — להמשיך לדחוף נפח בלולאת ישראל.",
  };
}
