/** Copy for /regulatory journalist kit — avoids inline JSX ternaries. */
export function regulatoryKitCopy(locale: string) {
  const he = locale === "he" || locale === "ar";
  if (he) {
    return {
      title: "ערכה לעיתונות ולפיקוח",
      sub: "מספרים אמיתיים בלבד מפעילות צרכנים מתועדת. אין המצאת נפח.",
      metaTitle: "ערכה רגולטורית | זכאי",
      metaDesc: "אגרגטים מתועדים בלבד — לא סקרים ולא דיווח רשמי.",
      schemaNote: (schema: string, version: string) =>
        `סכימה ${schema} · גרסה ${version}. זה אינו דיווח רשמי לרגולטור ולא סטטיסטיקה ממשלתית.`,
      briefCta: "ייצוא טקסט (brief)",
      jsonCta: "JSON מלא",
      pressureCta: "לחץ inbound למוסדות",
      gravityCta: "מדד כבידה (gravity)",
      institutions: "למוסדות",
      network: "הוכחות רשת",
      domains: "דומיינים",
    };
  }
  return {
    title: "Journalist & supervisor kit",
    sub: "Real counts only from documented consumer activity. No fabricated volume.",
    metaTitle: "Regulatory kit | Zakai",
    metaDesc: "Documented aggregates only — not surveys or official filings.",
    schemaNote: (schema: string, version: string) =>
      `Schema ${schema} · v${version}. Not an official regulatory filing or government statistic.`,
    briefCta: "Plain-text brief export",
    jsonCta: "Full JSON snapshot",
    pressureCta: "Institution inbound pressure",
    gravityCta: "Network gravity index",
    institutions: "Institutions",
    network: "Network proof",
    domains: "Domains",
  };
}
