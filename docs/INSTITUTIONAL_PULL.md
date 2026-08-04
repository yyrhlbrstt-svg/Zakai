# Institutional pull — למה מוסדות *חייבים* לבוא (בכנות)

מטרה: לא «מכירה» — **לחץ מובנה** שמגיע מהלקוחות, מהנתונים, ומהסטנדרט. אף סעיף כאן לא ממציא לקוחות חתומים.

## 1. לחץ מהתיבה (כבר בייצור)

כל מכתב/תיק שעובר בלולאה הסגורה יכול לכלול `letterFooter` → `/institutions`.

- **מנגנון:** DocuSign / כפתור תשלום — כל נמען הופך ללקוח פוטנציאלי.
- **מה מחזקים:** יותר ורטיקלים עם `SENT` אמיתי, footer קצר שלא נחתך, קישור ישיר ל-`/integrations` + Reference Verifier.
- **מדד:** `GET /api/institution/inbound-pressure` — נפח מתועד לפי `institutionId` ממופה (רק מעל `MIN_SAMPLE`).

## 2. חובה טכנית (אם מקבלים Mandate מ-Zakai)

| נכס | למה בלי זה כואב |
|-----|------------------|
| JWKS + trust registry | אין מי מאמת את החתימה |
| Revocation (signed `/api/mandate/revocations`; live `/status/{jti}` legacy) | סיכון fail-open על מנדט שבוטל |
| `decide` + test vectors | כל בנק ממציא מדיניות scope אחרת → תאונות |
| Settlement chain (`zks`) | ויכוח «מי אמר מה» בלי עדים חתומים |

**מנוף מובילות:** Reference Verifier + קיר Pioneers — מי שלא מופיע נשאר עם PDF ידני כשהמתחרה מציג «אימתנו offline».

## 3. מואט נתונים (רק אצלנו)

- **StrategyOutcome** — de-identified; משפר המלצה לצרכן הבא; בנק לא יכול לשחזר מהלקוח.
- **Oracle** (`POST /api/oracle/predict`) — הסתברות תשלום מכוילת + `confident: false` כשאין דגימה — מוצר ל-underwriting / חטיבת תביעות, לא לשכפול.
- **Company score** (`/companies`) — עובדות על נפח וחיסכון מתועד; ספקים גדולים ירצו לפחות לנטר.

## 4. הפצה B2B2C (הבנק מביא לקוחות, לא להפך)

- **embed + `partnerRef`** — attribution מדיד ב-signup; הבנק רואה ערוץ, לא רק «סטנדרט».
- **קמפיין `/go/[door]`** — דלתות ממותגות לפי שותף.
- **חובה:** בנק שמפספס embed משאיר את הצרכן לאפליקציה כללית בלי co-brand.

## 5. רגולציה וסיכון (הסיפור שמוכר לוועדת סיכון)

- **FORBIDDEN_SCOPES** — אין הוצאת כסף; זה לא slide, זה קוד + conformance.
- **Mandate inbound-only** — הדרך היחידה לקבל אלפי סוכנים בלי PSD2 על כל בוט.
- **Settlement / indeterminate** — לא ממציאים מנצח בויכוח.

## 6. רשת ותקן (אפקט רשת איטי אבל אמיתי)

- **מנפיקים רשומים** — Visa לא מנפיקה כרטיסים; מי שלא ב-registry לא «באותה רשת».
- **Conformance probe** — self-serve לפני אדם.
- **גרסאות 180 יום** — בנק לא ישקיע אינטגרציה בלי מחויבות שינוי.

## 7. מה לבנות הבא (עדיפות)

1. **Webhook / digest שבועי** למוסד שרשום ב-`ReferenceVerifier` — «N מנדטים חדשים עם aud=אתם» (בלי PII).
2. **שמירת `aud` על Authorization** — מיפוי ישיר ממנדט ללחץ נכנס (לא רק provider key).
3. **Badge ב-consumer UI** — «הבנק שלך תומך באימות Mandate» רק למי ב-leaders wall (opt-in).
4. **Oracle sandbox key** לפיילוט — 30 יום, read-only calibration export.
5. **מפת הזדמנויות** ממוקדת בנק (`bank-fees`, `dormant`) ב-`opportunity-map` עם citation ל-pack.

**Shipped:** `GET /api/cron/institution-inbound` (weekly, Vercel Cron) emails `ReferenceVerifier.contactEmail` with 7-day + all-time mapped volume.

## מה לא לעשות

- טענות «כבר עובדים עם X בנקים».
- דירוג שלילי על בנק מדגימה קטנה (שמור `MIN_SAMPLE`).
- scope תשלום יוצא — שובר את כל סיפור האימוץ.

---

קשור: `docs/REFERENCE_VERIFIER_PROGRAM.md`, `src/lib/letterFooter.ts`, `docs/PRODUCT_RATING.md`.
