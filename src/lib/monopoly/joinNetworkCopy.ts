/** Inline he/en copy for /join-network — institutional adoptability, not consumer SaaS. */

export function joinNetworkCopy(locale: string) {
  const he = locale === "he" || locale === "ar";
  if (he) {
    return {
      metaTitle: "הצטרפות לרשת זכאי | מוסדות · מנפיקים · סוכנים",
      metaDesc:
        "ערכת התקנה אחת: Mandate inbound, ZML packs, trust registry. בלי צוות שיחות חוזרות.",
      kicker: "Network join",
      title: "מצטרפים לרשת — לא לאפליקציה",
      sub: "בנק, מנפיק או סוכן AI מתקינים פעם אחת. הרשימות הציבוריות נשארות ריקות עד שמישהו באמת עובר.",
      institutionTitle: "מוסד / בנק / ספק",
      institutionBody: "לקבל Mandate מובנה, לעבור readiness, ולהופיע ב-leaders רק אחרי opt-in אמיתי.",
      institutionCta: "אשף Reference Verifier",
      issuerTitle: "מנפיק שני",
      issuerBody: "Dry-run מול validateIssuer, ואז הגשת delegated או JWKS — בלי שינוי אוטומטי ב-registry.",
      issuerCta: "חבילת evidence",
      agentTitle: "סוכן AI / שותף",
      agentBody: "הפניה עם utm, MCP לאימות בלבד, widget עם מפתח עמיד.",
      agentCta: "ערכת סוכנים",
      packsTitle: "מפתח ZML",
      packsBody: "לטעון packs מ-CDN/mirror — לא מה-UI של זכאי.",
      packsCta: "מראת packs",
      kitJson: "JSON לערכה המלאה",
      gates: "שערי שליטה (לא שווי)",
    };
  }
  return {
    metaTitle: "Join the Zakai network | Institutions · issuers · agents",
    metaDesc:
      "One install kit: Mandate inbound, ZML packs, trust registry. No callback team.",
    kicker: "Network join",
    title: "Join the network — not the app",
    sub: "Banks, issuers, and AI agents install once. Public leaderboards stay empty until someone actually passes.",
    institutionTitle: "Institution / bank / provider",
    institutionBody:
      "Accept structured Mandates, finish readiness, list on leaders only after a real opt-in.",
    institutionCta: "Reference Verifier wizard",
    issuerTitle: "Second issuer",
    issuerBody:
      "Dry-run against validateIssuer, then delegated apply or JWKS — registry never mutates itself.",
    issuerCta: "Evidence package",
    agentTitle: "AI agent / partner",
    agentBody: "Handoff with utm, verify-only MCP, durable widget key.",
    agentCta: "Agent economy",
    packsTitle: "ZML developer",
    packsBody: "Load packs from CDN/mirror — not Zakai UI.",
    packsCta: "Packs mirror",
    kitJson: "Full kit JSON",
    gates: "Control gates (not a valuation)",
  };
}

export function fairnessCertifiedPageCopy(locale: string) {
  const he = locale === "he" || locale === "ar";
  if (he) {
    return {
      metaTitle: "Fairness Certified | זכאי",
      metaDesc: "הטמעת ציון הוגנות רק כשיש MIN_SAMPLE אמיתי — בלי כוכבים מזויפים.",
      kicker: "Fairness Certified",
      title: "תוכנית ההטמעה לשותפים",
      sub: "מפרט בלבד עד שיש ציונים אמיתיים ואישור משפטי לסימן. הרשימה למטה ריקה או חיה מה-API — לא ידנית.",
      empty: "אין עדיין ספקים עם ציון מעל סף הדגימה. ה-widget חייב להציג מצב ריק — לא מספר בדוי.",
      live: "ספקים עם ציון חי (StrategyOutcome, MIN_SAMPLE):",
      embedTitle: "קוד הטמעה",
      partners: "לעמוד השותפים",
      api: "JSON התוכנית",
      legal: "זה אינו תו תקן משפטי. ראו docs/FAIRNESS_CERTIFIED_PROGRAM.md",
    };
  }
  return {
    metaTitle: "Fairness Certified | Zakai",
    metaDesc: "Embed fairness only when a real MIN_SAMPLE score exists — never fake stars.",
    kicker: "Fairness Certified",
    title: "Partner embed program",
    sub: "Spec-only until live scores exist and counsel clears the mark. The list below is empty or live from the API — never hand-edited.",
    empty: "No providers above the sample threshold yet. Widgets must show empty state — never invent a number.",
    live: "Providers with a live score (StrategyOutcome, MIN_SAMPLE):",
    embedTitle: "Embed snippet",
    partners: "Partners page",
    api: "Program JSON",
    legal: "Not a legal certification mark. See docs/FAIRNESS_CERTIFIED_PROGRAM.md",
  };
}
