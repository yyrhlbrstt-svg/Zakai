# SETUP — צ'קליסט ההפעלה של זכאי (למייסד)

*הפעולות שרק בעל החשבונות יכול לעשות, לפי סדר. כל השאר — בקוד וכבר בנוי.*

## 1. מפתח AI (מדליק צ'אט + ניתוח תמונות + סריקת צילומי מסך) — ~10 דק'

**מסלול מהיר בלי כרטיס אשראי — Gemini (נתמך):**
1. aistudio.google.com → Get API Key → Create API Key → מעתיקים את ה-`AIza...`.
2. Vercel → Settings → Environment Variables → Key: `GEMINI_API_KEY`, Value: המפתח → Save → Redeploy.
3. `/api/health` יראה `"ai": true, "aiProvider": "gemini"`.
הערה: למפתח החינמי יש מגבלות קצב; לשדרוג איכות ויציבות עוברים ל-Anthropic בהמשך.

**המסלול המומלץ לפרודקשן — Anthropic (Claude):** דורש כרטיס אשראי (משימת "המבוגר").
1. console.anthropic.com → הרשמה עם Google.
2. Billing → הוספת כרטיס → טעינת 5$ → הגדרת Spend Limit (מומלץ 10$/חודש).
3. API Keys → Create Key → העתקת ה-`sk-ant-...` (מוצג פעם אחת!).
4. vercel.com → פרויקט zakai → Settings → Environment Variables → Add:
   Key: `ANTHROPIC_API_KEY` | Value: המפתח → Save (Production + Preview).
5. Deployments → ⋯ → Redeploy → לחכות ל-Ready.
6. בדיקה: `/api/health` מציג `"ai": true`.

## 2. דומיין (אמינות — ביקורת מוצדקת: vercel.app נראה זמני) — ~50-90 ₪/שנה
1. קונים `zakai.co.il` (רשמים ישראלים: domains.co.il / interspace / box) או `getzakai.com` וכד'.
2. Vercel → פרויקט → Settings → Domains → Add → מזינים את הדומיין → מקבלים רשומות DNS (A/CNAME) → מגדירים אצל הרשם.
3. HTTPS אוטומטי דרך Vercel. שום שינוי קוד לא נדרש (הקישורים env-driven).
4. אחרי החיבור: לעדכן ב-Vercel את `NEXT_PUBLIC_APP_URL` לדומיין החדש + Redeploy.

## 3. המבחן הרטוב — הלקוח האמיתי הראשון
חשבונית סלולר אמיתית → בדיקה → ייפוי כוח → שליחה → תיעוד הזיכוי.
המערכת עוקבת בעצמה; ברגע שיש הוכחת חיסכון אמיתית — פס "כמה זכאי החזיר" בדף הבית נדלק אוטומטית.

## 4. עסק וסליקה (לפני גבייה ראשונה)
ישות עסקית (עם המבוגר) → חשבון סליקה (Grow/Cardcom/Tranzila) → עו"ד על terms/privacy.

## 5. ניקוי נתוני בדיקה לפני שיווק
במסד הפרודקשן נשארים משתמשי בדיקה מהפיתוח — למחוק דרך Settings→מחיקת חשבון של כל אחד, או לפנות אליי לניקוי מרוכז.
