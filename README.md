# זכאי (Zakai)

סוכן AI צרכני שמזהה חיובי **סלולר** מנופחים בישראל, מנסח פנייה מקצועית, פועל בשם הלקוח **באישורו המפורש**, וגובה **עמלת הצלחה של 18% מחיסכון מתועד בלבד**. ערוץ פעולה בשלב זה: הודעות (מייל/טופס), לא שיחות טלפון.

> MVP צר שעובד קצה-לקצה. קטגוריה אחת (סלולר), ערוץ אחד (מייל). הרחבות מתועדות ב-[`BACKLOG.md`](./BACKLOG.md) ואינן בקוד.

## מסמכים
- [`JOURNAL.md`](./JOURNAL.md) — יומן החלטות ופשרות תוך כדי הבנייה.
- [`COUNCIL.md`](./COUNCIL.md) — ממצאי פרוטוקול הביקורת (5 בוחנים) לכל רכיב מרכזי.
- [`BACKLOG.md`](./BACKLOG.md) — רעיונות עתידיים, לא ממומשים.

## Stack
Next.js 15 (App Router) · TypeScript · Tailwind · Prisma + PostgreSQL · next-intl (עברית RTL ראשית) · Anthropic (צד שרת) · Vitest.

## הרצה מקומית

```bash
npm install
cp .env.example .env            # ערוך לפי הצורך
npx prisma migrate deploy       # או: npm run db:migrate
npm run dev                     # http://localhost:3000
```

דורש PostgreSQL. `DATABASE_URL` ב-`.env`. ללא `ANTHROPIC_API_KEY` — קריאת חשבונית מתמונה מושבתת (קלט ידני עובד), והניסוח נופל ל-template מסומן. ללא `SMTP_*`/`SMS_PROVIDER` — הודעות נשמרות ב-`Outbox` ולא יוצאות (מצב פיתוח, ניתן לבדיקה מלאה).

## בדיקות

```bash
npm test          # יחידה + אינטגרציה (דורש DB רץ ל-integration)
npm run typecheck
npm run build
```

בדיקות קריטיות: `src/lib/fee.test.ts` (חישוב עמלה), `src/lib/codes.test.ts` + `src/lib/phone.test.ts`, `src/lib/services/ownership.integration.test.ts` (מנגנון אימות מול DB אמיתי).

## מסלול הליבה
`חיבור חשבונית → ניתוח → אישור משתמש (פר-פנייה) → אימות בעלות (SMS) + מסמך הרשאה (קוד אימות) → שליחת פנייה (מייל, עם גילוי) → מעקב תשובה → תיעוד הוכחת חיסכון → חישוב עמלה`.

שני מנגנוני האימות הם **תנאי חובה** לשליחה — לא ניתן לפנות בשם לקוח בלעדיהם.

## מבנה
```
src/
  app/[locale]/        דפים (בית, התחברות/הרשמה, check, dashboard, verify, authorization/[code])
  app/api/             route handlers (auth, cases/*, authorization/[code])
  components/          UI (client)
  i18n/                תצורת next-intl (he/en פעילות, ar/ru בארכיטקטורה)
  lib/                 money, fee, phone, codes, ai, messaging, providers, auth/*, services/*
  messages/            קטלוגי תרגום
prisma/schema.prisma   מודל הנתונים (כסף ב-agorot, טבלאות אמון append-only)
```

## אתיקה (לא סעיף קישוט)
גילוי מלא שזכאי הוא סוכן דיגיטלי · ללא הבטחות מוגזמות (לקח DoNotPay/FTC) · הסכמה מפורשת לפני כל פעולה · סלולר בלבד בשלב 1. תנאי השימוש הם טיוטת דוגמה — גרסה מסחרית מחייבת עורך דין.
