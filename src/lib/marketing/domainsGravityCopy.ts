/** Extra links on /domains — avoid inline JSX ternaries. */
export function domainsGravityLinks(locale: string) {
  const he = locale === "he" || locale === "ar";
  return {
    title: he ? "מדדי כבידה (אמיתיים בלבד)" : "Gravity meters (real only)",
    monopoly: he ? "שבע מסילות מונופול" : "Seven monopoly rails",
    gates: he ? "שערי שליטה (לא שווי)" : "Control gates (not valuation)",
    indispensability: he ? "למה אי אפשר להתעלם (JSON)" : "Why you can't ignore (JSON)",
    agents: he ? "כלכלת סוכנים" : "Agent economy",
    mustHave: he ? "חבילת חובה לצרכן" : "Consumer must-have kit",
    ignoreCost: he ? "עלות התעלמות למוסד" : "Institution ignore-cost",
    fairness: he ? "Fairness Certified (מפרט)" : "Fairness Certified (spec)",
  };
}
