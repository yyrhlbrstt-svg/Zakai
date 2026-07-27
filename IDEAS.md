# IDEAS — גל רעיונות 28 ביולי 2026

רעיונות חדשים לכיוון מוביל הקטגוריה. מה שכבר בקוד מסומן ✅.

---

## נבנה עכשיו (0.3.x)

| פריט | סטטוס |
|------|--------|
| Money OS כנתיב יחיד | ✅ |
| Cancel / from-scan → auto-APPROVED | ✅ 0.3.1 |
| תזכורת מעקב 7 ימים אחרי SENT | ✅ |
| תזכורת recheck ~180 יום אחרי SAVED | ✅ 0.3.2 |
| קרון nudges (SAVED + SENT) | ✅ |
| שיתוף ויראלי אחרי SAVED + referral | ✅ |
| Mandate Ed25519 + JWKS | ✅ |
| Multi-market packs IL/GB/US/DE/FR/CA | ✅ שלד |
| Overnight Agent | ✅ 0.3.3 |
| Mandate QR | ✅ 0.3.3 |
| Document vault | ✅ 0.3.4 |
| Zakai Wrapped | ✅ 0.3.4 |
| Public SavingsProof wall | ✅ 0.3.5 |
| Household CTA + grouping | ✅ 0.3.5 |
| Airline Case + Mandate | ✅ 0.3.6 |

---

## גל רעיונות חדש — ערך × מאמץ

### 🟢 לבנות בקרוב (מתלבש על הקיים)

1–8. ✅ (Overnight, Household, Wrapped, Proof wall, Mandate QR, Batch scan, Competitor, Document vault)

### 🟡 דורש תשתית / רגולציה

9. **Forward-email inbox**  
   המשתמש מעביר מייל מהספק ל-`cases@zakai…` → AI מחלץ סכום חדש → מציע "רשום חיסכון". סוגר הוכחה בלי Open Banking. דורש inbound email (SendGrid Inbound / Cloudflare Email).

10. **Web Push ב-PWA**  
    "הספק ענה? / הגיע זמן recheck". iOS 16.4+ תומך. דורש VAPID + service worker.

11. **טיסה כ-Case מלא** ✅ 0.3.6  
    EU261 / חוק שירותי תעופה → createCase(vertical=airline) + Mandate + מעקב. ה-checker + agent CTA קיימים.

12. **B2B embed widget**  
    `<script src="zakai.app/embed.js">` לבנקים/פינטק — "בדוק זכויות ללקוח". הכנסה B2B מהיום-הראשון אחרי ישות.

### 🔴 לא בונים (קווים אדומים)

- בוט שמאיים בתביעה / מייצג משפטית  
- ניטור כרטיס אשראי של צד ג' בלי הסכמה מפורשת  
- הבטחות "טריליון" כמטריקת מוצר — רק כחזון פנימי; החוץ: מוביל קטגוריה + ARR אמיתי

---

## סדר ביצוע מומלץ (הבא)

1. B2B embed skeleton (ללא תלות חיצונית)  
2. Forward-email inbox (SendGrid/Cloudflare) — סוגר proof loop  
3. Web Push PWA  

הכל בלי תלויות חיצוניות חדשות עד עכשיו. אחרי זה — inbound email / push.
