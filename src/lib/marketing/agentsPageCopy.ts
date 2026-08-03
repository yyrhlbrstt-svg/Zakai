/** Long-form Mandate-for-agents page — Hebrew + English (institutional). */

export type AgentsSection = {
  heading: string;
  paragraphs: string[];
  list?: string[];
  code?: string;
  footnote?: string;
};

export type AgentsPageCopy = {
  kicker: string;
  title: string;
  sub: string;
  inviteStrong: string;
  inviteRest: string;
  sections: AgentsSection[];
  readMoreHeading: string;
  readMore: { institutions: string; discovery: string; openapi: string };
};

const EN: AgentsPageCopy = {
  kicker: "For builders of AI agents — not only Zakai's own",
  title: "Every agent that acts for a person eventually needs to prove it",
  sub: "Cancel a subscription, dispute a charge, request a record, appeal a fine — any agent that does one of these on a person's behalf will eventually be asked who authorised it. Zakai Mandate is an open protocol — not proprietary to Zakai's consumer app.",
  inviteStrong: "This page is an invitation, not a claim.",
  inviteRest:
    "Nothing here says any agent already uses this. The protocol, reference verifier, SDK and conformance checks are real and buildable today — without calling Zakai at verification time.",
  sections: [
    {
      heading: "Why this isn't only a finance feature",
      paragraphs: [
        "Strip the money vocabulary: person P authorises agent A to perform act X against institution I — verifiably, revocably, within a limit, with a settlement record nobody can rewrite unilaterally.",
        "Finance is live today. Health, government, employment, housing and education are reserved with categorical limits already fixed in the spec.",
      ],
      list: [
        "Finance (live): an agent may never move money outward.",
        "Health (reserved): may never consent to treatment or alter a clinical record — only request, correct and dispute.",
        "Government (reserved): may never waive a right or enter a plea.",
      ],
    },
    {
      heading: "What your agent gets",
      paragraphs: [],
      list: [
        "Issue a signed mandate (EdDSA JWT) after explicit user action.",
        "Present it — counterparty verifies offline against JWKS.",
        "Settle disputes with mandate → decision → outcome hash chain.",
      ],
    },
    {
      heading: "Try it now",
      paragraphs: ["Three lines with any JWT library:"],
      code: `import { verifyMandateFromUrl } from "@zakai/mandate-sdk";

const claims = await verifyMandateFromUrl(token, {
  audience: "your-agent-or-institution-id",
  jwksUri: "{ORIGIN}/.well-known/zakai-jwks.json",
});`,
      footnote: "SDK source lives in this repo under sdk/ (not on npm yet).",
    },
    {
      heading: "What this will never do",
      paragraphs: [],
      list: [
        "Let a forbidden scope through — enforced in code globally.",
        "Require a live call to Zakai to verify (offline JWKS).",
        "Replace universal identity — only scoped, revocable authorisation.",
      ],
    },
  ],
  readMoreHeading: "Read more",
  readMore: {
    institutions: "Institutional integration guide →",
    discovery: "Discovery document →",
    openapi: "OpenAPI →",
  },
};

const HE: AgentsPageCopy = {
  kicker: "לבוני סוכני AI — לא רק המוצר של זכאי",
  title: "כל סוכן שפועל בשם אדם יצטרך בסוף להוכיח סמכות",
  sub: "ביטול מנוי, ערעור על חיוב, בקשת רשומה, ערעור קנס — כל סוכן שעושה זאת בשם משתמש יישאל מי הרשה לו. פרוטוקול Mandate של זכאי הוא תקן פתוח — לא קנייני לאפליקציית הצרכן.",
  inviteStrong: "הדף הזה הוא הזמנה, לא טענת שיווק.",
  inviteRest:
    "אין כאן טענה שסוכן כלשהו כבר משתמש בזה. הפרוטוקול, ה-verifier, ה-SDK ובדיקות conformance קיימים — אפשר לבנות עליהם היום, בלי לחייג לזכאי בזמן אימות.",
  sections: [
    {
      heading: "למה זה לא רק פיננסים",
      paragraphs: [
        "מבלי אוצר מילים של כסף: אדם P מרשה לסוכן A לבצע פעולה X מול מוסד I — בצורה ניתנת לאימות, לביטול, עם תקרה ורשומת settlement שלא ניתנת לשכתוב חד-צדדי.",
        "פיננסים פעילים היום. בריאות, ממשל, עבודה, דיור והשכלה שמורים עם גבולות קטגוריים שכבר קבועים במפרט.",
      ],
      list: [
        "פיננסים (חי): סוכן לעולם לא מוציא כסף החוצה.",
        "בריאות (שמור): לא נותן הסכמה לטיפול ולא משנה רשומה קלינית — רק מבקש, מתקן ומערער.",
        "ממשל (שמור): לא מוותר על זכות ולא מגיש הודאה.",
      ],
    },
    {
      heading: "מה הסוכן שלכם מקבל",
      paragraphs: [],
      list: [
        "הנפקת Mandate חתום (JWT EdDSA) אחרי פעולה מפורשת של המשתמש.",
        "הצגה לצד השני — אימות offline מול JWKS.",
        "יישוב מחלוקות עם שרשרת mandate → decision → outcome.",
      ],
    },
    {
      heading: "נסו עכשיו",
      paragraphs: ["שלוש שורות עם כל ספריית JWT:"],
      code: `import { verifyMandateFromUrl } from "@zakai/mandate-sdk";

const claims = await verifyMandateFromUrl(token, {
  audience: "your-agent-or-institution-id",
  jwksUri: "{ORIGIN}/.well-known/zakai-jwks.json",
});`,
      footnote: "קוד ה-SDK נמצא בריפו תחת sdk/ (עדיין לא ב-npm).",
    },
    {
      heading: "מה זה לעולם לא יעשה",
      paragraphs: [],
      list: [
        "יאפשר scope אסור — נאכף בקוד, גלובלית.",
        "ידרוש שיחה חיה לזכאי לאימות (JWKS offline).",
        "יחליף זהות אוניברסלית — רק הרשאה מוגבלת וניתנת לביטול.",
      ],
    },
  ],
  readMoreHeading: "קראו עוד",
  readMore: {
    institutions: "מדריך שילוב מוסדי →",
    discovery: "מסמך discovery →",
    openapi: "OpenAPI →",
  },
};

export function agentsPageCopy(locale: string): AgentsPageCopy {
  if (locale === "he" || locale === "ar") return HE;
  return EN;
}
