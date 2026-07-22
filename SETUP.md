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

**מסלול מקומי בלי מפתח ובלי עלות — Ollama (נתמך):** להרצה על מחשב שלך (ה"מחשב שתביא").
1. מתקינים Ollama מ-ollama.com, ואז בטרמינל: `ollama pull llama3.1` (לניתוח תמונות: `ollama pull llama3.2-vision`).
2. מריצים `ollama serve` (רץ על `http://localhost:11434`).
3. מגדירים משתני סביבה: `OLLAMA_BASE_URL=http://localhost:11434` ו-`OLLAMA_MODEL=llama3.1`.
4. אם אין `ANTHROPIC_API_KEY`/`GEMINI_API_KEY` — זכאי ישתמש אוטומטית ב-Ollama. `/api/health` יראה `"aiProvider": "ollama"`.
**מסלול "חכם וזול" — DeepSeek (מומלץ לשדרוג הצ'אט):** מודל חזק בהרבה מ-Gemini החינמי, בפרוטות.
1. נרשמים ב-platform.deepseek.com → API Keys → Create → מעתיקים את המפתח.
2. טוענים קרדיט קטן (בדרך כלל $2 מספיקים להמון שימוש — DeepSeek זול מאוד).
3. Vercel → Environment Variables → Key: `DEEPSEEK_API_KEY`, Value: המפתח → Save → Redeploy.
4. `/api/health` יראה `"aiProvider": "openai"`. הצ'אט יהיה חכם משמעותית.
> אפשר גם כל endpoint תואם-OpenAI (OpenRouter, Together, Groq) עם `OPENAI_COMPAT_API_KEY` + `OPENAI_COMPAT_BASE_URL` + `OPENAI_COMPAT_MODEL`.

**מסלול חינמי לגמרי — OpenRouter (מודלים חכמים בחינם):**
1. openrouter.ai → הרשמה → Keys → Create Key (חינם).
2. Vercel → Environment Variables:
   - `OPENAI_COMPAT_API_KEY` = המפתח
   - `OPENAI_COMPAT_BASE_URL` = `https://openrouter.ai/api/v1`
   - `OPENAI_COMPAT_MODEL` = `deepseek/deepseek-chat-v3.1:free` (או מודל חינמי אחר, למשל `meta-llama/llama-3.3-70b-instruct:free`)
3. Save → Redeploy. הסוכן יהיה חכם, בחינם. (למודלים ה"חינמיים" יש מגבלות קצב — לפרודקשן כבד עוברים ל-DeepSeek בתשלום זעום.)

**⭐ מומלץ ביותר לחינמי — Groq (הכי מהיר, מכסה חינמית נדיבה, Llama 3.3 70B):**
1. console.groq.com → הרשמה → API Keys → Create (חינם, בלי כרטיס אשראי).
2. Vercel → Environment Variables:
   - `OPENAI_COMPAT_API_KEY` = המפתח
   - `OPENAI_COMPAT_BASE_URL` = `https://api.groq.com/openai/v1`
   - `OPENAI_COMPAT_MODEL` = `llama-3.3-70b-versatile`
3. Save → Redeploy. Groq מהיר במיוחד (תשובות כמעט מיידיות) ובעל מכסה חינמית טובה — הבחירה הכי טובה לצ'אט חינמי. (מקור רשימת ספקים חינמיים: github.com/cheahjs/free-llm-api-resources.)

> ⚠️ חשוב: Ollama רץ על **המחשב שלך**. הפריסה בענן (Vercel) תגיע אליו רק אם המחשב חשוף לאינטרנט (מנהרה כמו ngrok/cloudflared, ואז `OLLAMA_BASE_URL` = כתובת המנהרה). להרצה מקומית מלאה (`npm run dev` על אותו מחשב) — עובד מיד. זו הסיבה שלפרודקשן ענן, מפתח ענן (Gemini/Anthropic) עדיין הכי פשוט.

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
