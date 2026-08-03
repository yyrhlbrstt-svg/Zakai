/**
 * Ethical retention — keep finishing money paths. No dark patterns.
 */

export type RetentionActionKind =
  | "rescan"
  | "open_case_from_scan"
  | "complete_send"
  | "follow_up"
  | "document_saving"
  | "share_proof"
  | "household"
  | "deadline"
  | "vigil";

export interface RetentionSignal {
  kind: RetentionActionKind;
  priority: number; // higher = sooner
  href: string;
  reasonKey: string;
}

export interface RetentionUserSnapshot {
  /** Days since last statement scan persisted on device is unknown server-side — pass null. */
  daysSinceLastServerCase: number | null;
  openAnalyzedOrApproved: number;
  openVerifiedReadyToSend: number;
  openSent: number;
  savedWithoutRecentShare: boolean;
  householdBeneficiaryCases: number;
  upcomingDeadlines: number;
  openVigilAlerts: number;
  hasAnySaved: boolean;
}

const RESCAN_AFTER_DAYS = 90;

/**
 * Pure ranking of next retention moves from dashboard-visible state.
 */
export function planRetentionActions(snap: RetentionUserSnapshot): RetentionSignal[] {
  const out: RetentionSignal[] = [];

  if (snap.openVigilAlerts > 0) {
    out.push({
      kind: "vigil",
      priority: 100,
      href: "/dashboard",
      reasonKey: "retention.vigil",
    });
  }
  if (snap.upcomingDeadlines > 0) {
    out.push({
      kind: "deadline",
      priority: 95,
      href: "/deadlines",
      reasonKey: "retention.deadline",
    });
  }
  if (snap.openVerifiedReadyToSend > 0) {
    out.push({
      kind: "complete_send",
      priority: 90,
      href: "/dashboard",
      reasonKey: "retention.send",
    });
  }
  if (snap.openAnalyzedOrApproved > 0) {
    out.push({
      kind: "complete_send",
      priority: 85,
      href: "/dashboard",
      reasonKey: "retention.approve_verify",
    });
  }
  if (snap.openSent > 0) {
    out.push({
      kind: "follow_up",
      priority: 80,
      href: "/dashboard",
      reasonKey: "retention.follow_up",
    });
  }
  if (snap.openSent > 0 || snap.hasAnySaved === false) {
    /* document_saving surfaces when user likely has a reply */
  }
  if (snap.hasAnySaved && snap.savedWithoutRecentShare) {
    out.push({
      kind: "share_proof",
      priority: 70,
      href: "/dashboard",
      reasonKey: "retention.share",
    });
  }
  if (snap.householdBeneficiaryCases === 0 && snap.hasAnySaved) {
    out.push({
      kind: "household",
      priority: 40,
      href: "/check",
      reasonKey: "retention.household",
    });
  }
  if (
    snap.daysSinceLastServerCase == null ||
    snap.daysSinceLastServerCase >= RESCAN_AFTER_DAYS
  ) {
    out.push({
      kind: "rescan",
      priority: 50,
      href: "/money#zakai-money-scan",
      reasonKey: "retention.rescan",
    });
  }

  return out.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

export function retentionStripTitle(locale: string): string {
  const he = locale === "he" || locale === "ar";
  return he ? "מה הכי חשוב עכשיו" : "Highest-leverage next steps";
}

export function retentionCopy(locale: string, reasonKey: string): string {
  const he = locale === "he" || locale === "ar";
  const map: Record<string, { he: string; en: string }> = {
    "retention.vigil": {
      he: "יש התראת מעקב פתוחה — בדקו מה השתנה",
      en: "Open vigil alert — check what changed",
    },
    "retention.deadline": {
      he: "מועד מתקרב — תזכורת ממתינה",
      en: "A deadline is approaching",
    },
    "retention.send": {
      he: "תיק מאומת — חסר רק שליחה לספק",
      en: "Verified case — send to the provider",
    },
    "retention.approve_verify": {
      he: "יש טיוטה שמחכה לאישור או אימות בעלות",
      en: "A draft waits for approval or ownership verify",
    },
    "retention.follow_up": {
      he: "נשלח — הכינו מעקב כתוב אם אין תשובה",
      en: "Sent — prepare a written follow-up if no reply",
    },
    "retention.share": {
      he: "תועד חיסכון — שתפו וסגרו לולאת צמיחה",
      en: "Saving documented — share and close the growth loop",
    },
    "retention.household": {
      he: "בדקו גם לבני משפחה (תווית מוטב)",
      en: "Run a check for family (beneficiary label)",
    },
    "retention.rescan": {
      he: "סריקת חיובים מחדש — דפוסים משתנים",
      en: "Re-scan charges — patterns change",
    },
  };
  const row = map[reasonKey];
  if (!row) return reasonKey;
  return he ? row.he : row.en;
}
