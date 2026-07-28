# איך רואים את הכול — זכאי v1.1.0

אתר חי: **https://zakai-3uxj.vercel.app**

אחרי push ל-`main`, Vercel בונה מחדש (דקה–שתיים). אם משהו נראה ישן — רענון קשיח / מצב גלישה פרטית.

---

## 1. בדיקת גרסה (חובה)

פתח:

```
https://zakai-3uxj.vercel.app/api/version
```

צריך לראות `"version": "1.1.0"` (או לפחות `1.0.0` אם ה-deploy עדיין רץ).

---

## 2. מסלול צרכני (Consumer)

| מה | קישור (עברית) |
|---|---|
| דף הבית + 4 דלתות בעיה | `/he` |
| הכסף שלי (סריקה) | `/he/money` |
| ביטול מנוי עם סוכן | `/he/cancel` |
| מה מגיע לי | `/he/what-am-i-owed` |
| חשמל — מעבר ספק + סוכן | `/he/electricity` |
| עמלות בנק | `/he/bank-fees` |
| מפת נזילות | `/he/leaks` |
| קיר חיסכונות | `/he/proofs` |
| דשבורד (אחרי login) | `/he/dashboard` |
| התחל | `/he/start` |
| אמון | `/he/trust` |

**לופ מלא לבדיקה:**
1. הרשמה `/he/signup`
2. `/he/money` או `/he/electricity` או `/he/cancel`
3. פתיחת תיק → אימות בעלות (SMS/קישור מייל)
4. לחיצה אחת: Mandate + שליחה
5. בדשבורד: SENT → העברת מייל ל-proofs@ / רישום חיסכון
6. אחרי SAVED: שיתוף + דלתות המשך

---

## 3. מסלול תשתית (Mandate / B2B)

| מה | קישור |
|---|---|
| גילוי Mandate | `/.well-known/zakai-mandate.json` |
| מפתחות ציבוריים | `/.well-known/zakai-jwks.json` |
| OpenAPI | `/api/mandate/openapi.json` |
| סקופים מותרים | `/api/mandate/scopes` |
| אימות (מוסדי, CORS) | `POST /api/mandate/verify` |
| סטטוס jti | `GET /api/mandate/status/{jti}` |
| דף מוסדות | `/en/institutions` |
| B2B עובדים + Mandate | `/he/business` |
| שותפים + Embed | `/he/partners` |
| Embed script | `/embed.js` |

**Embed לדוגמה:**

```html
<div id="zakai-embed" data-locale="he" data-ref="demo" data-path="electricity"></div>
<script src="https://zakai-3uxj.vercel.app/embed.js" async></script>
```

---

## 4. שווקים ושפות

- שפות: `/he` · `/en` · `/ar` · `/ru`
- שווקים בנתונים: IL · GB · US · DE · FR · CA

---

## 5. Full-service verticals (ישראל)

telecom · bank-fees · subscription · airline · refund-chase · parking · transport-fine · **electricity**

כולם: Case → Mandate → שליחה → מעקב סוכן → SavingsProof → עמלה רק על חיסכון מתועד.

---

## 6. אם משהו לא מופיע

1. `/api/version` — האם הגרסה חדשה?
2. Vercel Dashboard → Deployments → האם build ירוק?
3. Hard refresh / incognito
4. `DEPLOY_MARKER.txt` ב-repo צריך להיות `version=1.1.0`
