# איך רואים את הכול — זכאי

אתר חי: **https://zakai-3uxj.vercel.app**

אחרי push ל-`main`, Vercel בונה מחדש (דקה–שתיים). אם משהו נראה ישן — רענון קשיח (Ctrl+Shift+R) / מצב גלישה פרטית.

---

## 0. בדיקת גרסה (חובה — לפני הכל)

פתח בדפדפן:

```
https://zakai-3uxj.vercel.app/api/version
```

- `version` חייב להיות זהה ל-`version` שב-`package.json` ב-`main` (הוא נקרא משם אוטומטית — אין יותר מספר קשיח בקוד).
- `buildMarker` הוא 12 התווים הראשונים של ה-commit SHA שנפרס. השווה אותו ל-`git log -1` ב-`main` — אם הם שונים, Vercel עדיין לא פרס את הקומיט האחרון (או שה-deploy נכשל).

אם הגרסה ישנה — ה-deploy עדיין רץ. חכה דקה ורענן.

---

## 1. מסלול צרכני (Consumer) — למה אנשים נכנסים

| מה | קישור (עברית) |
|---|---|
| **דף הבית + 4 דלתות בעיה** | `/he` |
| הכסף שלי (סריקת חיובים) | `/he/money` |
| ביטול מנוי עם סוכן | `/he/cancel` |
| מה מגיע לי | `/he/what-am-i-owed` |
| חשמל — מעבר ספק + סוכן | `/he/electricity` |
| עמלות בנק | `/he/bank-fees` |
| מפת נזילות | `/he/leaks` |
| קיר חיסכונות (ויראלי) | `/he/proofs` |
| דשבורד (אחרי login) | `/he/dashboard` |
| התחל | `/he/start` |
| אמון | `/he/trust` |
| טיסות / פיצוי | `/he/flights` |
| חניה / קנס | `/he/parking` · `/he/transport-fine` |

### לופ מלא לבדיקה (5–10 דקות)

1. הרשמה `/he/signup`
2. בחר דלת: `/he/money` **או** `/he/electricity` **או** `/he/cancel`
3. פתיחת תיק → אימות בעלות (SMS **או** קישור מייל)
4. **לחיצה אחת:** Mandate + שליחה לספק
5. בדשבורד: סטטוס SENT → העברת מייל תשובה ל-`proofs@…` / רישום חיסכון
6. אחרי SAVED: שיתוף ויראלי + דלתות המשך + תזכורת recheck בעוד ~6 חודשים

**מצב משפחה:** בדשבורד — תיקים עם תווית (אמא / סבתא) מקובצים בנפרד. תווית בלבד, בלי גישה לחשבון של צד ג'.

---

## 2. מסלול תשתית (Mandate / B2B) — איך מוסדות רואים

| מה | קישור |
|---|---|
| גילוי Mandate | `/.well-known/zakai-mandate.json` |
| מפתחות ציבוריים (JWKS) | `/.well-known/zakai-jwks.json` |
| OpenAPI | `/api/mandate/openapi.json` |
| סקופים מותרים | `/api/mandate/scopes` |
| אימות (מוסדי, CORS) | `POST /api/mandate/verify` |
| סטטוס jti | `GET /api/mandate/status/{jti}` |
| דף מוסדות | `/en/institutions` |
| B2B עובדים + Mandate | `/he/business` |
| שותפים + Embed | `/he/partners` |
| Embed script | `/embed.js` |
| Fairness widget | `/widget/zakai-widget.js` · `docs/WIDGET_EMBED.md` |
| פרוטוקול (JSON) | `/.well-known/zakai-protocol.json` |
| **תקן Interop (התחילו כאן)** | `/.well-known/zakai-interop.json` · `GET /api/interop?probe=1` · `/he/standard` |
| ZML schema | `/.well-known/zakai-rights-schema.json` |
| OpenAPI (ZML + APIs) | `/.well-known/zakai-openapi.json` |
| קטלוג זכויות | `GET /api/rights/catalog?market=IL` |
| אימות מפתח ווידג'ט | `GET /api/widget/validate` |
| למה זכאי / תנאים | `/he/about` · `/he/terms` · `/he/protocol` |

### Embed לדוגמה (העתק לאתר חיצוני)

```html
<div id="zakai-embed" data-locale="he" data-ref="demo" data-path="electricity"></div>
<script src="https://zakai-3uxj.vercel.app/embed.js" async></script>
```

---

## 3. שווקים ושפות

- שפות: `/he` · `/en` · `/ar` · `/ru`
- שווקים בנתונים (packs): IL · GB · US · DE · FR · CA
- זכויות עמוקות ב-US/GB (student loans, SSA, tax, energy, housing) + DE/FR/CA

---

## 4. Full-service verticals (ישראל) — כולם אותו שפה

telecom · bank-fees · subscription · airline · refund-chase · parking · transport-fine · **electricity**

כולם: Case → Mandate → שליחה → מעקב סוכן (עד 4 סיבובים) → SavingsProof → עמלה **רק** על חיסכון מתועד.

---

## 5. מה הסוכן עושה לבד (בלי טלפון)

- שליחה ראשונה + Mandate מצורף
- סיבובי follow-up אוטומטיים (cron, 5+ ימים בלי תשובה)
- זיהוי תשובת ספק ממייל נכנס (inbound) → הצעת "רשום חיסכון בלחיצה אחת"
- תזכורת recheck אחרי ~180 יום (מבצעים נגמרים)
- Web Push: "הסוכן פעל" / "תשובה הגיעה"

---

## 6. אם משהו לא מופיע

1. `/api/version` — האם `version` תואם ל-`package.json` ו-`buildMarker` תואם ל-commit האחרון ב-`main`?
2. אחרי merge ל-`main`, הרץ smoke על פרודקשן:

```bash
node scripts/verify-production-urls.mjs https://zakai-3uxj.vercel.app
```

(פרוטוקול / ZML / ווידג'ט ייכשלו עד שה-deploy החדש עלה.)

3. Vercel Dashboard → Deployments → build ירוק?
4. Hard refresh / incognito
5. אם UI ישן — נקה cache של הדפדפן

### zakai-packs → CDN

```bash
chmod +x scripts/export-zakai-packs-repo.sh
./scripts/export-zakai-packs-repo.sh
# push ל-repo נפרד + הגדרת secrets לפי docs/INFRA_ZAKAI_PACKS.md
```

---

## 7. דוקטרינה (לא משתנה)

- **No-callback** — אין מוקד, אין "תשאיר טלפון"
- **Closed-loop** — צילום מסך פנימה → חיסכון מתועד החוצה
- **Inbound-only Mandate** — אין תשלומים יוצאים
- **18% רק על SavingsProof** (Pro/Max מוזלים)
- כל ורטיקל מדבר אותה שפת Case
