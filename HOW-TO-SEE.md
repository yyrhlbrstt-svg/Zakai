# איך רואים את הכול — זכאי v1.2.0 FINAL

אתר חי: **https://zakai-3uxj.vercel.app**

אחרי push ל-`main`, Vercel בונה מחדש (דקה–שתיים). אם משהו נראה ישן — רענון קשיח (Ctrl+Shift+R) / מצב גלישה פרטית.

---

## 0. בדיקת גרסה (חובה — לפני הכל)

פתח בדפדפן:

```
https://zakai-3uxj.vercel.app/api/version
```

צריך לראות:

```json
"version": "1.2.0"
"buildMarker": "final-dual-track-production-2026-07-28"
```

אם עדיין 1.1.0 — ה-deploy עדיין רץ. חכה דקה ורענן.

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

1. `/api/version` — האם `1.2.0`?
2. Vercel Dashboard → Deployments → build ירוק?
3. Hard refresh / incognito
4. `DEPLOY_MARKER.txt` ב-repo = `version=1.2.0`
5. אם UI ישן — נקה cache של הדפדפן

---

## 7. דוקטרינה (לא משתנה)

- **No-callback** — אין מוקד, אין "תשאיר טלפון"
- **Closed-loop** — צילום מסך פנימה → חיסכון מתועד החוצה
- **Inbound-only Mandate** — אין תשלומים יוצאים
- **18% רק על SavingsProof** (Pro/Max מוזלים)
- כל ורטיקל מדבר אותה שפת Case
