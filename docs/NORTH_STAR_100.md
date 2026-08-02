# North star — 100/10 (בכנות)

**«משהו שאף אחד לא היה»** כאן = שלושה דברים ביחד, לא סלוגן:

1. **לולאה צרכנית סגורה בכתב** — detect → אישור אדם → Mandate → שליחה → מעקב → הוכחה → עמלה → למידה (בלי מוקד).
2. **סמכות מכונה שניתנת לאימות offline** — JWKS, scopes אסורים, revoke, decide — בלי להוציא כסף החוצה.
3. **לחץ הפוך מהשוק** — כל מכתב/מייל נושא footer + `aud`; מוסד שנרשם מקבל התראה על נפח מתועד.

**100/10 אינו ציון שיווקי.** זה מצב שבו:

| שכבה | קריטריון «הגענו» |
|------|-------------------|
| **Env** | `releaseScore: 100`, `canReleaseConsumerApp: true` בפרוד |
| **לולאה** | תיקים אמיתיים: SENT לא QUEUED, SAVED עם `SavingsProof`, fee PAID |
| **מוסד** | לפחות אחד: verify self-serve + (אופציונלי) Reference Verifier + מייל על dispatch |
| **נתונים** | `StrategyOutcome` גדל; Oracle נפתח ללקוח מוסדי אחד — לא לציבור |
| **מותג** | win rate מתועד בוורטיקל אחד שחוזר על עצמו (סלולר או בנק) |

## מה הקוד עושה כבר לכיוון 100/10

- `sendOutreach` — **footer מוסדי** על כל שליחה לספק (לא רק בנק).
- `mandateAudience` — בנקים עם `aud` מוסדי.
- `notifyInstitutionOnOutboundSend` — מוסד רשום מקבל ping (בלי PII) כשמייל באמת **SENT**.
- Reference Verifier, inbound pressure, digest שבועי.
- ~1376+ בדיקות, release gate, founder metrics.

## מה עדיין חסר (לא ייפוי)

- נפח צרכני אמיתי בפרוד (אתם).
- PayPlus + SMTP + Mandate ב-Vercel (אתם).
- מיפוי `aud` לסלולר/חשמל (cellcom, iec…) — שלב 2 אחרי בנקים.
- Webhook חתום (HMAC) במקום רק מייל — שלב 3.
- SOC2 / SLA מוסדי — רק אחרי פיילוט.

## כלל מנכ"ל

**אין PR שמעלה ציון שוק בלי ledger.**  
כל ספרינט חייב: Find / Act / Prove / Spread — או תשתית שמאפשרת אחד מהם בפרוד.

ראה: `docs/PRODUCT_RATING.md`, `docs/INSTITUTIONAL_PULL.md`, `docs/RELEASE_100_HE.md`.
