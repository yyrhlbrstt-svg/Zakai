/** Long-form /institutions sections below quick integration — EN + HE. */

export type InstitutionsLongSection = {
  id: string;
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  numbered?: string[];
  pre?: string;
  tailParagraphs?: string[];
  softParagraphs?: string[];
};

export type InstitutionsLongTail = {
  endpointsHeading: string;
  pilotHeading: string;
  pilotBody: string;
  trustLink: string;
  businessLink: string;
  openapiLink: string;
};

export type InstitutionsLongCopy = {
  sections: InstitutionsLongSection[];
  tail: InstitutionsLongTail;
};

function en(origin: string): InstitutionsLongCopy {
  return {
    sections: [
      {
        id: "network",
        heading: "What you cannot replicate without the network",
        paragraphs: [
          "Signature verification is free to implement from the spec — and should be. What requires Zakai (or a future admitted issuer you trust through the same registry) is the live network layer:",
        ],
        bullets: [
          `Trust registry — who may issue at all, with which scopes: ${origin}/.well-known/zakai-trust-registry.json`,
          "Revocation status — per-mandate live check: GET /api/mandate/status/{jti} or the signed status list at /api/mandate/revocations",
          "Outcome Oracle — calibrated pay probability from de-identified case outcomes: POST /api/oracle/predict (API key; institutions channel)",
          `Agent platforms — verification-only MCP server: zakai-mandate-mcp (see discoverability in ${origin}/.well-known/zakai-mandate.json)`,
          `Opportunity map — monetizable consumer verticals (machine-readable): ${origin}/api/network/opportunity-map`,
          "Integration quickstart — step-by-step verify/decide/revoke in ~30 minutes: see docs/INSTITUTION_QUICKSTART.md in the repository (same steps as this page's endpoints).",
        ],
      },
      {
        id: "roi",
        heading: "What this is worth to your team, in your own numbers",
        paragraphs: [
          "Not an industry benchmark — three inputs your own ops team already has, computed live:",
        ],
      },
      {
        id: "hardConstraint",
        heading: "Hard constraint (the adoption feature)",
        paragraphs: [
          "A Mandate cannot initiate outbound payments, transfers, loans, or account closure. Those scopes are forbidden in code, not merely omitted.",
          "Money only flows toward the consumer (refunds, settlements). That is why a regulated institution can accept these at scale.",
        ],
      },
      {
        id: "decide",
        heading: "The short integration: one call, no authorization logic",
        paragraphs: [
          "Verifying a token tells you it is authentic and leaves you the real question: may this agent do this act, right now? That is roughly fifty lines every integrator writes, writes differently, and gets one of wrong — usually the line where holding “may cancel my subscriptions” is mistaken for agreement to cancel this one.",
        ],
        pre: `POST /api/mandate/decide
Content-Type: application/json

{
  "token": "<jwt>",
  "audience": "<your-institution-id>",
  "action": "dispute:charge",
  "actConfirmation": "<your-reference>"
}

→ { "decision": "permit" | "deny",
    "reason": "<closed set>",
    "obligations": ["record:<jti>", "notify_principal:<action>"],
    "permitted": ["read:accounts", "dispute:charge"] }`,
        bullets: [
          "A deny returns 200, not 4xx. A refusal is a successful answer to a legitimate question, and conflating it with a network error is how integrations end up failing open.",
          "Deny by default. No path returns permit on error, and an unknown revocation status is a deny rather than a permit with a warning.",
          "reason is a closed set, so you can branch on it without it breaking when we reword something.",
          "Prefer to hold no dependency on us? Everything above is derivable offline from the JWS, the JWKS and the signed status list. The endpoint is a convenience, never a requirement.",
        ],
      },
      {
        id: "testVectors",
        heading: "Prove your implementation is correct, without asking us",
        paragraphs: [
          "A specification tells you what to do. It does not tell you whether you did it. Prose is ambiguous in exactly the places that matter — is the audience compared before or after expiry, is a missing claim a refusal or a pass, does an unestablished revocation status mean yes — and every implementer resolves those differently, silently.",
        ],
        pre: `GET ${origin}/api/mandate/test-vectors`,
        tailParagraphs: [
          "Deterministic fixtures — fixed key, fixed timestamps, fixed identifiers — covering every decision outcome, plus the orderings where two rules could both fire. Run them in your own language against your own code. There is no partial credit: one wrong answer in a trust network is one participant honouring something nobody else does.",
          "The rules are also implemented five times over — Python, Go, Java, Ruby and PHP — each a single file with no dependencies at all, and all five agree on all nineteen vectors. The decision layer performs no cryptography, so each is something you can read in ten minutes and run with a runtime you already have: paste a file rather than clear a package through review.",
        ],
        softParagraphs: [
          "The signing key in that document is published on purpose, exactly as RFC test vectors publish theirs, so you can regenerate the fixtures rather than take our word for them. Its issuer sits under .invalid and has no trust-registry entry, so no conforming verifier will ever accept a mandate signed with it.",
          "A specification only its author has implemented is an API with documentation. Writing the second one found two ambiguities in the first, and writing the vectors found a real bug in ours — it reported expired for a token that also carried a forbidden scope, hiding a registry-level incident behind a stale credential.",
        ],
      },
      {
        id: "settlement",
        heading: "Settlement: who is right when you disagree later",
        paragraphs: [
          "Authorization says who may act. It does not settle what happened. When an agent says it was told to act, you say nothing arrived, and the customer says they never agreed — today that is resolved by someone reading logs owned by one of the disputants.",
          "So each act produces a chain of three signed statements: the mandate, your decision, and the outcome. Each link carries a hash of the one before it, each is signed by the party making that claim, and no central party — including us — can fabricate one. Adjudication is a pure function of the records, so the same chain yields the same verdict for you, for the consumer, for a regulator, and for a court, months later.",
        ],
        bullets: [
          "Receipts are ordinary JWTs (zks claim). Same keys and libraries as the mandate — nothing new to adopt.",
          "Verdicts are a closed set, and indeterminate is one of them: a procedure that always produces a winner will sometimes invent one.",
          "A recorded refusal is never treated as fault. Punishing the participants who behave correctly is how a network loses them.",
          "It settles whether an act was authorised and matched. It does not opine on whether the underlying claim was any good — that is a question about the world, and answering it would be making things up.",
        ],
      },
      {
        id: "delegatedIssuance",
        heading: "Mandates you did not expect to see: delegated issuance",
        paragraphs: [
          "Not every mandate presented to you was requested by a person who signed up on this site. A third-party agent that would rather not run its own Ed25519 keys can have Zakai sign on its behalf, for its own users, whom Zakai has never met.",
          "That distinction is not hidden in prose you would have to read — it is a field on the verified claims:",
        ],
        pre: `"zkm": {
  "principal": { ... },
  "onBehalfOf": {
    "agent": "some-agent.example",
    "name": "Some Agent",
    "note": "Issued by Zakai on behalf of the named agent.
              The principal's identity was verified by
              that agent, not by Zakai."
  }
}`,
        bullets: [
          "Absent means first-party: Zakai verified the principal itself, same as any mandate on this page so far.",
          "Present means the identity check behind it was performed by the named agent, not by Zakai — a narrower assurance, and one you may reasonably choose to price, log or gate differently.",
          "The delegated issuer never appears in the trust registry: it holds no key and signs nothing, so it has no iss of its own. iss on these mandates is still Zakai's — check zkm.onBehalfOf, not the issuer list, to find them.",
          "Every categorical limit still applies: a delegated issuer cannot obtain a scope forbidden to anyone, and can never exceed the specific subset it was admitted for — enforced in code, not by agreement.",
        ],
      },
      {
        id: "delegatedApply",
        heading: "Building a competing agent? Become a delegated issuer",
        paragraphs: [
          "If you run a consumer agent and would rather not stand up your own Ed25519 key infrastructure, apply here directly. No call, no email thread — fill this in and a human reviews it. Admission to a trust boundary is never fully automatic, but finding the human to ask shouldn't be your problem.",
        ],
      },
      {
        id: "registeredIssuer",
        heading: "Run your own keys instead? Become a registered issuer",
        paragraphs: [
          "Delegated issuance above is for an agent that would rather not run Ed25519 infrastructure of its own. If you already sign your own mandates and want an iss of your own inside the trust registry — the actual Visa-not-issuing-cards shape of this network — that is a different, harder admission, and it does not start with a form:",
        ],
        numbered: [
          `Read and implement against ${origin}/.well-known/zakai-conformance.json — the admission test, published, deliberately hostile: it checks that your implementation refuses a forged signature, enforces audience and expiry, and will never issue a scope in forbidden_scopes.`,
          "Run it against your own endpoints. Nobody at Zakai reads your source.",
          `Check yourself first, before a human does: POST ${origin}/api/mandate/conformance/probe takes your public JWKS plus a sample mandate you issued and runs the reference verifier here against them independently — 7 of the 10 checks settled without anyone reading a self-report, including yours. It cannot check status-list freshness or revocation propagation from a single call; those two, plus expiry if you did not send an expired sample, come back listed under report.missing rather than silently assumed to pass.`,
          "Bring the result through the same technical-pilot form below (select Mandate / institutional API) — admission to a trust boundary is never fully automatic, but finding the human to ask shouldn't be your problem either.",
        ],
      },
      {
        id: "versioning",
        heading: "Versioning: what we will and will not change under you",
        paragraphs: [
          "The question that actually decides whether an integration is worth building isn't whether the format works today — it's whether it will still mean the same thing in a year. So it's a written commitment, not a hope:",
        ],
        bullets: [
          "v1 is additive-only. A new optional field can appear without a version bump; a verifier that ignores fields it doesn't recognise keeps working exactly as it does today.",
          "No claim is ever repurposed. A retired field stays retired — it is never redefined to mean something else under the same name.",
          "Forbidden scopes only grow. A scope can move from permitted to forbidden; the reverse never happens without a major version, because that is the direction that could silently widen authority you already granted.",
          "A major version carries a minimum 180-day overlap window before the prior version stops verifying.",
        ],
      },
      {
        id: "sixSteps",
        heading: "Integration in six steps",
        numbered: [
          `Protocol manifest (start here): GET ${origin}/.well-known/zakai-protocol.json`,
          `Discover endpoints: GET ${origin}/.well-known/zakai-mandate.json`,
          `Cache public keys: GET ${origin}/.well-known/zakai-jwks.json`,
          "Verify the JWT with your existing library (EdDSA / Ed25519, typ = JWT)",
          "Reject if aud is not your institution id",
          "Reject if exp is past (allow small clock skew)",
          "Recency check: GET /api/mandate/status/{jti} → only active",
        ],
      },
      {
        id: "referenceVerify",
        heading: "Reference verify call",
        pre: `POST /api/mandate/verify
Content-Type: application/json

{
  "token": "<compact-jws>",
  "audience": "<your-institution-id>"
}`,
      },
    ],
    tail: {
      endpointsHeading: "Endpoints",
      pilotHeading: "Request a technical pilot",
      pilotBody:
        "Read-only verification of sample Mandates against your institution id. No production dependency on Zakai availability is required for signature checks. Select Mandate / institutional API (or Both) in the form.",
      trustLink: "Trust & security →",
      businessLink: "Business page →",
      openapiLink: "OpenAPI →",
    },
  };
}

function he(origin: string): InstitutionsLongCopy {
  return {
    sections: [
      {
        id: "network",
        heading: "מה שלא ניתן לשכפל בלי הרשת",
        paragraphs: [
          "אימות חתימה חופשי ליישום מהמפרט — וכך צריך להיות. מה שדורש את זכאי (או מנפיק עתידי שאתם סומכים עליו דרך אותו registry) הוא שכבת הרשת החיה:",
        ],
        bullets: [
          `Trust registry — מי רשאי להנפיק בכלל, ובאילו scopes: ${origin}/.well-known/zakai-trust-registry.json`,
          "סטטוס ביטול — בדיקה חיה לכל mandate: GET /api/mandate/status/{jti} או רשימת סטטוס חתומה ב-/api/mandate/revocations",
          "Outcome Oracle — הסתברות תשלום מכוילת מתוצאות תיקים מנותקות: POST /api/oracle/predict (מפתח API; ערוץ מוסדות)",
          `פלטפורמות סוכנים — שרת MCP לאימות בלבד: zakai-mandate-mcp (ראו discoverability ב-${origin}/.well-known/zakai-mandate.json)`,
          `מפת הזדמנויות — ורטיקלים צרכניים (machine-readable): ${origin}/api/network/opportunity-map`,
          "Quickstart לשילוב — verify/decide/revoke בכ~30 דקות: docs/INSTITUTION_QUICKSTART.md בריפו (אותם צעדים כמו ב-endpoints בעמוד זה).",
        ],
      },
      {
        id: "roi",
        heading: "מה זה שווה לצוות שלכם, במספרים שלכם",
        paragraphs: ["לא בנצ'מרק תעשייה — שלושה קלטים שצוות התפעול כבר מחזיק, מחושבים כאן ועכשיו:"],
      },
      {
        id: "hardConstraint",
        heading: "אילוץ קשיח (תכונת האימוץ)",
        paragraphs: [
          "Mandate לא יכול ליזום תשלומים יוצאים, העברות, הלוואות או סגירת חשבון. ה-scopes האלה אסורים בקוד, לא רק חסרים.",
          "כסף זורם רק לכיוון הצרכן (החזרים, פשרות). לכן מוסד מפוקח יכול לקבל את זה בקנה מידה.",
        ],
      },
      {
        id: "decide",
        heading: "שילוב קצר: קריאה אחת, בלי לוגיקת הרשאה משלכם",
        paragraphs: [
          "אימות טוקן אומר שהוא אמיתי — השאלה האמיתית: האם הסוכן רשאי לבצע את הפעולה הזו, עכשיו? זה בערך חמישים שורות שכל אינטגרטור כותב אחרת וטועה באחת — לרוב כש«מותר לבטל מנויים» מתפרש כהסכמה לבטל את המנוי הספציפי הזה.",
        ],
        pre: `POST /api/mandate/decide
Content-Type: application/json

{
  "token": "<jwt>",
  "audience": "<your-institution-id>",
  "action": "dispute:charge",
  "actConfirmation": "<your-reference>"
}

→ { "decision": "permit" | "deny",
    "reason": "<closed set>",
    "obligations": ["record:<jti>", "notify_principal:<action>"],
    "permitted": ["read:accounts", "dispute:charge"] }`,
        bullets: [
          "deny מחזיר 200, לא 4xx. סירוב הוא תשובה תקינה לשאלה לגיטימית — לערבב עם שגיאת רשת זה איך אינטגרציות נכשלות פתוח.",
          "deny כברירת מחדל. אין מסלול שמחזיר permit בשגיאה; סטטוס ביטול לא ידוע הוא deny, לא permit עם אזהרה.",
          "reason הוא סט סגור — אפשר לענף עליו בלי ששינוי ניסוח ישבור אתכם.",
          "מעדיפים בלי תלות בנו? הכול נגזר offline מה-JWS, ה-JWKS ורשימת הסטטוס החתומה. ה-endpoint הוא נוחות, לא דרישה.",
        ],
      },
      {
        id: "testVectors",
        heading: "הוכיחו שהמימוש נכון — בלי לשאול אותנו",
        paragraphs: [
          "מפרט אומר מה לעשות, לא אם עשיתם נכון. פרוזה עמומה בדיוק במקומות שחשובים — audience לפני או אחרי expiry, claim חסר הוא סירוב או מעבר, סטטוס ביטול לא מבוסס — וכל מיישם פותר אחרת, בשקט.",
        ],
        pre: `GET ${origin}/api/mandate/test-vectors`,
        tailParagraphs: [
          "Fixtures דטרמיניסטיים — מפתח, זמנים ומזהים קבועים — לכל תוצאת החלטה, כולל סדרים שבהם שני כללים יכולים להתנגש. הריצו בשפתכם על הקוד שלכם. אין ציון חלקי: תשובה שגויה אחת ברשת אמון היא משתתף שמכבד משהו שאף אחד אחר לא.",
          "הכללים מיושמים גם בחמש שפות — Python, Go, Java, Ruby ו-PHP — קובץ בודד בלי תלויות, וכל חמשתן מסכימות על כל תשע עשרה ה-vectors. שכבת ההחלטה לא עושה קריפטוגרפיה — אפשר לקרוא בעשר דקות ולהריץ עם runtime שכבר יש לכם.",
        ],
        softParagraphs: [
          "מפתח החתימה במסמך פורסם בכוונה (כמו RFC test vectors) כדי שתוכלו לחשב מחדש את ה-fixtures. ה-issuer תחת .invalid וללא רשומה ב-trust registry — verifier תקין לא יקבל mandate חתום בו.",
          "מפרט שרק המחבר מימש הוא API עם תיעוד. המימוש השני מצא שתי עמימויות; ה-vectors מצאו באג אמיתי אצלנו — expired על טוקן עם scope אסור, שהסתיר אירוע registry מאחורי credential ישן.",
        ],
      },
      {
        id: "settlement",
        heading: "Settlement: מי צודק כשלא מסכימים אחר כך",
        paragraphs: [
          "הרשאה אומרת מי רשאי לפעול — לא מה קרה. כשהסוכן אומר שנתבקש לפעול, אתם אומרים שלא הגיע כלום, והלקוח אומר שלא הסכים — היום פותרים בקריאת לוגים של אחד הצדדים.",
          "לכן כל פעולה יוצרת שרשרת של שלוש הצהרות חתומות: mandate, ההחלטה שלכם, וה-outcome. כל קישור נושא hash של הקודם, כל אחד חתום על ידי הצד שטוען — ואף גורם מרכזי, כוללנו, לא יכול לזייף. השיפוט הוא פונקציה טהורה של הרשומות — אותה שרשרת, אותו פסק דין עבורכם, הצרכן, רגולטור ומשפט, חודשים אחר כך.",
        ],
        bullets: [
          "קבלות הן JWT רגילים (claim zks). אותם מפתחות וספריות כמו ב-mandate.",
          "פסקי דין בסט סגור; indeterminate הוא אחד מהם — פרוצדורה שתמיד מחזירה מנצח לפעמים ממציאה אחד.",
          "סירוב מתועד לעולם לא נספר כאשמה. להעניש מי שמתנהג נכון — כך רשת מאבדת משתתפים.",
          "זה מסכם האם הפעולה הורשתה והתאימה — לא האם הטענה עצמה הייתה נכונה בעולם.",
        ],
      },
      {
        id: "delegatedIssuance",
        heading: "Mandates שלא ציפיתם אליהם: הנפקה מואצלת",
        paragraphs: [
          "לא כל mandate שהוצג אליכם נתבקש על ידי מישהו שנרשם באתר. סוכן צד שלישי שלא רוצה להריץ מפתחות Ed25519 משלו יכול לבקש שזכאי תחתום בשמו, למשתמשים שלו — שזכאי מעולם לא פגשה.",
          "ההבחנה לא מוסתרת בפרוזה — היא שדה ב-claims המאומתים:",
        ],
        pre: `"zkm": {
  "principal": { ... },
  "onBehalfOf": {
    "agent": "some-agent.example",
    "name": "Some Agent",
    "note": "Issued by Zakai on behalf of the named agent.
              The principal's identity was verified by
              that agent, not by Zakai."
  }
}`,
        bullets: [
          "היעדר השדה = first-party: זכאי אימתה את ה-principal בעצמה.",
          "נוכחות = בדיקת הזהות בוצעה על ידי הסוכן שבשם, לא על ידי זכאי — הבטחה צרה יותר; מותר לתמחר, לתעד או לסנן אחרת.",
          "המנפיק המואצל לא ב-trust registry: אין לו מפתח ואין iss משלו. iss עדיין של זכאי — בדקו zkm.onBehalfOf, לא רשימת מנפיקים.",
          "כל הגבול הקטגורי עדיין חל: מנפיק מואצל לא יכול לקבל scope אסור לכל אחד, ולא לחרוג מהתת-קבוצה שאושרה — בקוד, לא בהסכם.",
        ],
      },
      {
        id: "delegatedApply",
        heading: "בונים סוכן מתחרה? הפכו למנפיק מואצל",
        paragraphs: [
          "אם אתם מפעילים סוכן צרכני ולא רוצים תשתית מפתחות משלכם — הגישו כאן. בלי שיחה, בלי שרשור מייל — מילוי ואדם בודק. קבלה לגבול אמון לעולם לא אוטומטית לגמרי, אבל למצוא את האדם לשאול לא צריך להיות הבעיה שלכם.",
        ],
      },
      {
        id: "registeredIssuer",
        heading: "מעדיפים מפתחות משלכם? הפכו למנפיק רשום",
        paragraphs: [
          "הנפקה מואצלת למי שלא רוצה תשתית Ed25519. אם אתם כבר חותמים mandates משלכם ורוצים iss משלכם ב-trust registry — צורת «ויזה שלא מנפיקה כרטיסים» — זו קבלה אחרת וקשה יותר; היא לא מתחילה בטופס:",
        ],
        numbered: [
          `קראו וממשו מול ${origin}/.well-known/zakai-conformance.json — מבחן קבלה ציבורי ועוין: מימוש שמסרב לחתימה מזויפת, אוכף audience ו-expiry, ולעולם לא מנפיק scope ב-forbidden_scopes.`,
          "הריצו מול ה-endpoints שלכם. אף אחד בזכאי לא קורא את הקוד שלכם.",
          `בדקו לפני שאדם בודק: POST ${origin}/api/mandate/conformance/probe עם JWKS ציבורי ומנדט לדוגמה — 7 מתוך 10 בדיקות בלי דיווח עצמי. רעננות status-list והפצת ביטול לא נבדקות בקריאה אחת — יופיעו ב-report.missing.`,
          "הביאו את התוצאה דרך טופס הפיילוט למטה (בחרו Mandate / institutional API) — קבלה לגבול אמון לא אוטומטית לגמרי, אבל למצוא את האדם לשאול גם כאן לא הבעיה שלכם.",
        ],
      },
      {
        id: "versioning",
        heading: "גרסאות: מה נשנה ומה לא תחתיכם",
        paragraphs: [
          "השאלה שקובעת אם שווה לבנות אינטגרציה היא לא אם הפורמט עובד היום — אלא אם ימשיך להיות אותו דבר בעוד שנה. זו התחייבות כתובה, לא תקווה:",
        ],
        bullets: [
          "v1 additive בלבד. שדה אופציונלי חדש בלי bump; verifier שמתעלם משדות לא מוכרים ממשיך לעבוד.",
          "אף claim לא מקבל משמעות חדשה. שדה שיצא לפנסיה נשאר כך.",
          "scopes אסורים רק גדלים. מותר ל-forbidden; ההפך רק בגרסה major — כי זה מרחיב סמכות בשקט.",
          "גרסה major דורשת חפיפה מינימלית של 180 יום לפני שהקודמת מפסיקה לאמת.",
        ],
      },
      {
        id: "sixSteps",
        heading: "שילוב בשישה צעדים",
        numbered: [
          `מניפסט פרוטוקול (התחילו כאן): GET ${origin}/.well-known/zakai-protocol.json`,
          `Discovery: GET ${origin}/.well-known/zakai-mandate.json`,
          `מפתחות ציבוריים: GET ${origin}/.well-known/zakai-jwks.json`,
          "אימות JWT עם הספרייה הקיימת (EdDSA / Ed25519, typ = JWT)",
          "דחו אם aud אינו מזהה המוסד שלכם",
          "דחו אם exp עבר (סטיית שעון קטנה מותרת)",
          "רעננות: GET /api/mandate/status/{jti} → רק active",
        ],
      },
      {
        id: "referenceVerify",
        heading: "קריאת verify לדוגמה",
        pre: `POST /api/mandate/verify
Content-Type: application/json

{
  "token": "<compact-jws>",
  "audience": "<your-institution-id>"
}`,
      },
    ],
    tail: {
      endpointsHeading: "Endpoints",
      pilotHeading: "בקשת פיילוט טכני",
      pilotBody:
        "אימות read-only של Mandates לדוגמה מול מזהה המוסד שלכם. אין תלות בזמינות זכאי לבדיקות חתימה. בטופס בחרו Mandate / institutional API (או Both).",
      trustLink: "אמון ואבטחה →",
      businessLink: "עמוד עסקי →",
      openapiLink: "OpenAPI →",
    },
  };
}

export function institutionsLongCopy(locale: string, origin: string): InstitutionsLongCopy {
  if (locale === "he" || locale === "ar") return he(origin);
  return en(origin);
}
