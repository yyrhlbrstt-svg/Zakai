# שחרור רק ב־100/100 (מייסד)

אתה אמרת שלא משחררים עד שהכול מוכן. **«100» כאן = `releaseScore` ב־`/api/release-gate`**, לא תחושת בטן.

## פקודות (במחשב או אחרי deploy)

```bash
node scripts/preflight.mjs      # מינימום deploy (blocking בלבד)
npm run release-gate            # שחרור צרכני מלא — חייב 100
curl -s https://zakai-3uxj.vercel.app/api/release-gate | jq
```

## שלב 1 — סודות שלא נכנסים ל-git

```bash
node scripts/bootstrap-release-env.mjs
```

הדבק את הפלט ב־**Vercel → Environment Variables → Production**, ואז **Redeploy** (לא Stale).

חובה מעבר ל־preflight:

| משתנה | למה |
|--------|-----|
| `CRON_SECRET` | מעקב אוטומטי בפרוד |
| `MANDATE_SIGNING_JWK` + `MANDATE_SIGNING_KID` | חתימת Mandate |
| `MANDATE_ISSUER` | כתובת האתר האמיתית |
| `NEXT_PUBLIC_APP_URL` | קישורים במייל ובמנדט |

## שלב 2 — דואר (בלי זה אין שחרור)

| משתנה | למה |
|--------|-----|
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Outbox יוצא לספק |
| `SMTP_FROM` | דומיין עם SPF/DKIM |
| `LEADS_EMAIL`, `SALES_EMAIL` | תיבות נפרדות (לא רק fallback) |
| `ADMIN_EMAIL` | `/he/founder` + אימות מייל |

## שלב 3 — כסף אמיתי (PayPlus — אצלך)

```
PAYMENT_PROVIDER=payplus
PAYPLUS_API_KEY=
PAYPLUS_SECRET_KEY=
PAYPLUS_PAYMENT_PAGE_UID=
```

עד אז `payments_live` נכשל ב־release gate — **בכוונה**.

## שלב 4 — AI (לחוויית מלאה)

`ANTHROPIC_API_KEY` (או DeepSeek/Gemini/OpenAI-compat) — בלי זה OCR וטיוטות עשירות נשארים בתבניות.

## אימות לפני לחיצה על «פרסום»

1. `npm run release-gate` על סביבה שמחוברת ל־env של Vercel (או `curl /api/release-gate` בפרוד)
2. `releaseScore: 100` ו־`canReleaseConsumerApp: true`
3. `/he/founder` — פאנל שער שחרור ירוק
4. תיק אחד אמיתי: SENT עם מייל **לא** QUEUED, ואז SAVED

## מה הקוד כבר עושה בלי env

- מוצר, מנדט, דלתות גלובליות, `llms.txt`, MCP, בדיקות (1289+)
- **לא** מזייף 100 בפרוד — הציון יורד עד שממלאים env

ראה גם: `docs/EXCELLENCE_SCORECARD.md`, `docs/VERCEL_PRODUCTION_CHECKLIST.md`
