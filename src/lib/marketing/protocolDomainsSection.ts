/**
 * Extended copy for /protocol — six monopoly domains (no inline JSX ternaries).
 */
export function protocolDomainsSection(locale: string) {
  const he = locale === "he" || locale === "ar";
  if (he) {
    return {
      title: "שש שכבות תשתית (מעל כולם)",
      sub: "לא מונופול בשקר — כל שכבה ניתנת לבדיקה חיצונית. פירוט: /domains",
      items: [
        { name: "Mandate", note: "סמכות חתומה, JWKS, ביטול" },
        { name: "ZML", note: "זכויות כנתונים — קטלוג וחבילות" },
        { name: "Fairness", note: "ציון הוגנות רק מעל MIN_SAMPLE" },
        { name: "Switching", note: "מעבר ספק — מטא-דאטה בכל outbound" },
        { name: "Regulatory", note: "אגרגטים לפיקוח — לא דיווח רשמי" },
        { name: "Collective", note: "ביקוש אנונימי — בלי מכרז עדיין" },
      ],
      cta: "לדף ששת הדומיינים",
      security: "מה חשוף בפרוד ומה למייסד בלבד",
      securityCta: "מדיניות שטח ציבורי",
    };
  }
  return {
    title: "Six infrastructure layers (above everyone)",
    sub: "Monopoly by standard and volume — each layer is externally testable. Details: /domains",
    items: [
      { name: "Mandate", note: "Signed authority, JWKS, revocation" },
      { name: "ZML", note: "Rights as data — catalog and packs" },
      { name: "Fairness", note: "Scores only above MIN_SAMPLE" },
      { name: "Switching", note: "Provider switch — metadata on every outbound" },
      { name: "Regulatory", note: "Supervisor aggregates — not official filings" },
      { name: "Collective", note: "Anonymous demand — no auction yet" },
    ],
    cta: "Domains hub",
    security: "What is public in prod vs founder-only",
    securityCta: "Public surface policy",
  };
}
