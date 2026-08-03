/** Extra links on /domains — avoid inline JSX ternaries. */
export function domainsGravityLinks(locale: string) {
  const he = locale === "he" || locale === "ar";
  return {
    title: he ? "מדדי כבידה (אמיתיים בלבד)" : "Gravity meters (real only)",
    monopoly: he ? "שבע מסילות מונופול" : "Seven monopoly rails",
    gates: he ? "שערי שליטה (לא שווי)" : "Control gates (not valuation)",
    agents: he ? "כלכלת סוכנים" : "Agent economy",
    mustHave: he ? "חבילת חובה לצרכן" : "Consumer must-have kit",
    ignoreCost: he ? "עלות התעלמות למוסד" : "Institution ignore-cost",
  };
}
