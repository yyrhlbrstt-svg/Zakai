/** Extra nav labels not in messages/nav (global doors, etc.). */
export const TOOL_EXTRA_LABELS: Record<string, { he: string; en: string }> = {
  money: { he: "הכסף שלי", en: "My money" },
  leaks: { he: "מפת נזילות", en: "Leaks map" },
  proofs: { he: "קיר חיסכונות", en: "Savings wall" },
  cancel: { he: "ביטול מנוי", en: "Cancel sub" },
  whatAmIOwed: { he: "מה מגיע לי", en: "What am I owed" },
  creditcard: { he: "ריבית כרטיס", en: "Card interest" },
  refundchase: { he: "החזר שלא הגיע", en: "Missing refund" },
  contractCheck: { he: "בדיקת חוזה", en: "Contract check" },
  overtimeBackPay: { he: "שעות נוספות", en: "Unpaid overtime" },
  latePayment: { he: "לקוח לא משלם", en: "Late-paying client" },
  scamCheck: { he: "זה עוקץ?", en: "Is this a scam?" },
  complaintEscalation: { he: "התלונה לא נענתה", en: "Complaint ignored" },
  deadlines: { he: "דדליינים", en: "Deadlines" },
  advanceTax: { he: "הקטנת מקדמות מס", en: "Reduce tax advances" },
  schoolPayments: { he: "תשלומי הורים", en: "School payments" },
  alimonyGuarantee: { he: "מזונות מובטחים", en: "Guaranteed alimony" },
  businessCompensation: { he: "פיצויי נזק עקיף", en: "Business war damage" },
  holocaustSurvivors: { he: "זכויות ניצולי שואה", en: "Holocaust survivor rights" },
  integrations: { he: "אינטגרציה למוסדות", en: "Institution integration" },
  studentLoan: { he: "הלוואת סטודנטים (UK)", en: "UK student loan" },
  wageAudit: { he: "תלוש שכר (US)", en: "US wage audit" },
  debtCollector: { he: "גביית חוב (US)", en: "US debt validation" },
  trainDelay: { he: "עיכוב רכבת", en: "Train delay" },
  consumerCancel: { he: "ביטול 14 יום", en: "14-day cancel" },
  tollDispute: { he: "ערעור כביש 6", en: "Toll dispute" },
  vehicleLicenseRefund: { he: "החזר אגרת רישוי", en: "Licence refund" },
  collectionComplaint: { he: "תלונה על גובה חוב", en: "Collector complaint" },
  carInsuranceRefund: { he: "החזר ביטוח רכב", en: "Car insurance refund" },
  vaadBait: { he: "ועד בית — פירוט", en: "HOA transparency" },
  waterBill: { he: "חשבון מים — נזילה", en: "Water leak credit" },
  landlordRepairs: { he: "תיקון בדירה שכורה", en: "Rental repairs" },
  duplicateCharge: { he: "חיוב כפול", en: "Duplicate charge" },
  telecomExit: { he: "ניתוק סלולר", en: "Telecom disconnect" },
  networkProof: { he: "הוכחת רשת (ציבורי)", en: "Network proof (public)" },
  domainsHub: { he: "חמשת הדומיינים", en: "Five domains hub" },
  institutionLeader: { he: "מובילי אימות Mandate", en: "Mandate verification leaders" },
  globalMarkets: { he: "עולם · שווקים", en: "World · markets" },
  standardInterop: { he: "תקן Interop", en: "Interop standard" },
  protocolPage: { he: "פרוטוקול זכאי", en: "Zakai protocol" },
};

export function toolDisplayLabel(
  key: string,
  he: boolean,
  navLookup: (key: string) => string,
): string {
  const extra = TOOL_EXTRA_LABELS[key];
  if (extra) return he ? extra.he : extra.en;
  try {
    return navLookup(key);
  } catch {
    return key;
  }
}
