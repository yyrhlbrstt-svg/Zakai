# Fairness Layer — יישור מנכ"ל ↔ מוצר (בלי פנטזיית הכנסה)

מסמך פנימי: איך הבrief של "שכבת ההוגנות העולמית" מתיישב עם מה שבנוי בקוד, מה סותר, ומה הסדר הבא.

**כנות על סדרי גודל:** עמלת הצלחה צרכנית לבדה לא מגיעה ל"מיליארדים בחודש".
זה סדר גודל של תשתית נפח (Visa-class), לא של אפליקציית recovery.
יעד ריאלי קרוב: לולאה מושלמת בישראל + נפח SavingsProof + Mandate כסטנדרט.
מאות מיליונים–מיליארדים *בשנה* אפשריים רק אחרי תשתית אמיתית — ראו `MARKET-REALITY.md`.

## מה כבר קיים (שלב 1 מהבrief)

| יעד | סטטוס | איפה |
|-----|--------|------|
| ZML + קטלוג ציבורי | ✅ | `/.well-known/zakai-rights-schema.json`, `GET /api/rights/catalog` |
| 76 זכויות IL ב-packs | ✅ | `zakai-packs/packs/il/rights/` |
| ווידג'ט + שותפים | ✅ חלקי | `public/widget/`, `/he/partners`, `docs/WIDGET_EMBED.md` |
| פרוטוקול discovery | ✅ | `/.well-known/zakai-protocol.json`, `GET /api/protocol` |
| OpenAPI | ✅ | `/.well-known/zakai-openapi.json` |
| מחשבון בית (Zakameter) | ✅ | `Zakameter.tsx` — breakdown + CTA |
| ביטול אוניברסלי (ללא שליחה משרת) | ✅ חדש | `/he/cancel/universal` — CSV בדפדפן, העתקה בלבד |
| SEO דפי זכות | ✅ חדש | `/he/rights/{slug}` — ~76 דפים ב-sitemap |
| תנאים + דוקטרינות | ✅ | `legalPages`, `docs/CONSUMER_DOCTRINES.md` |

## מתחים קריטיים (לא להתעלם)

### 1. "Word — רק מכינים, המשתמש שולח"

הבrief: אין שליחה אוטומטית משרתי זכאי.

**המציאות בקוד:** לופ סוכן (telecom וכו') שולח מייל משרת אחרי Mandate + לחיצה; cron שולח סיבובי המשך 2–4 תחת Mandate פעיל.

**הפתרון האסטרטגי (לא "או-או"):**

- **ברירת מחדל ויראלית:** כלים ציבוריים + ביטול מרוכז + מכתבים להעתקה (ללא API send).
- **אופציונלי מודרך:** "שלח עם Mandate" רק אחרי אימות בעלות — מוצר פרימיום, לא ה-hook הראשון.
- **תיעוד:** תנאים כבר מתארים סיבובי המשך; הבrief צריך לעדכן ל"שליחה ראשונה ידנית, המשך רק תחת Mandate" — לא "אף פעם לא מהשרת".

### 2. "אין Google Analytics צד שלישי"

הבrief מציע GA; **חוק המוצר:** עוגיית session בלבד, בלי tracking צד שלישי.

**הפתרון:** מדידה פנימית — `StrategyOutcome`, `/proofs`, `/results`, אירועי שרת (Outbox, SAVED), founder dashboard. לא להוסיף GA בלי שינוי מדיניות פרטיות מפורש.

### 3. סליקה

הבrief מזכיר Stripe; **הפרודקשן:** PayPlus (`PAYMENT_PROVIDER`). לא להחליף בלי החלטת מייסד — לחבר PayPlus לפני "שבוע 1".

### 4. "מיליארד בחודש" — לא יעד ביצוע עכשיו

אם בכלל מגיעים לסדר גודל כזה, זה רק כ־**פרוטוקול נפח** (מוסדות מאמתים Mandates, packs ב-CDN, embed בבנקים) — לא כ־ARR של עמלת הצלחה על חיסכון.
עד ש־`gravity_tier` לא מראה נפח אמיתי, לדבר על זה כמדד הצלחה הוא שקר עצמי.
המסלול הכנה היחיד: B2C הוכחות בישראל → Mandate כסטנדרט → שכבות תשתית שקופות → ורק אז גלובלי.

## סדר ביצוע מומלץ (אחרי המיזוג הנוכחי)

### עכשיו (קוד — סוכן / solo)

1. ~~דפי SEO לזכויות~~ + sitemap + אינדקס ב-`/rights`
2. ~~ביטול אוניברסלי client-only~~
3. ~~`GET /api/protocol`~~
4. ~~`GET /api/fairness/scores`~~ (StrategyOutcome, MIN_SAMPLE)
5. ~~ווידג'ט: mount על `data-api-key`, white-label~~
6. ~~OpenAPI: fairness + widget validate~~
7. ~~ציון הוגנות ב-`/companies` + מסלול העתקה ב-`/check`~~
8. 10 פוסטי SEO נוספים = תוכן ב-`rights.items` (כבר קיים) — שיווק ידני
9. `zakai-packs` repo חיצוני + `ZML_PACKS_CDN` (מייסד + AWS)

### חודש 3–9 (B2B)

- מפתחות widget בפרודקשן (`ZAKAI_WIDGET_KEYS_JSON`)
- Fairness Score ציבורי מנתונים אמיתיים בלבד (מינימום N תצפיות לפני ציון)
- white-label CSS לווידג'ט

### חודש 9+ (עולם)

- Reverse auction MVP — רק אחרי consent מפורש + ללא PII באגרגציה
- Redis ל-cache packs (היום: in-memory + CDN)

## מדדים מהבrief — כנה

| מדד | איך נמדוד בלי לשקר |
|-----|---------------------|
| משתמשים רשומים | DB users count (founder בלבד) |
| חיסכון מוכח | `provenSavings()` / SavingsProof בלבד |
| TikTok | מחוץ למוצר |
| מפתחים | contributors ל-`zakai-packs` |
| שותפים B2B | מפתחות widget פעילים + embed בדומיין אמיתי |

## המשפט המנחה

> פרוטוקול שהעולם לא יכול לפעול בלעדיו — **מתחיל בכנות**: Word לפני Post Office, הוכחה לפני עמלה, ZML פתוח לפני מכרז הפוך.

עדכון אחרון: אוגוסט 2026
