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
| B2B embed widget | ✅ 0.3.6 |
| Refund-chase Case | ✅ 0.3.6 |
| Bank-fees Case + Mandate | ✅ 0.3.7 |

---

## גל רעיונות — ערך × מאמץ

### 🟢 סגור

כל פריטי ה-green + airline + B2B embed + refund + bank-fees.

### 🟡 דורש תשתית / רגולציה

1. **Forward-email inbox**  
   המשתמש מעביר מייל מהספק ל-`cases@zakai…` → AI מחלץ סכום חדש → מציע "רשום חיסכון". סוגר הוכחה בלי Open Banking. דורש inbound email (SendGrid Inbound / Cloudflare Email).

2. **Web Push ב-PWA**  
   "הספק ענה? / הגיע זמן recheck". iOS 16.4+ תומך. דורש VAPID + service worker.

3. **העמקת global packs**  
   GB/US/DE/FR/CA — eligibility copy + provider lists אמיתיים מעבר לשלד.

4. **העלאת bank-fees ל-full**  
   אחרי proof אמיתי על תיקים שנסגרו (level: assisted → full).

### 🔴 לא בונים

- בוט שמאיים בתביעה / מייצג משפטית  
- ניטור כרטיס אשראי של צד ג' בלי הסכמה מפורשת  
- הבטחות "טריליון" כמטריקת מוצר חיצונית

---

## סדר ביצוע מומלץ (הבא)

1. העמקת global packs (GB קודם) — בלי תלות חיצונית  
2. Forward-email inbox  
3. Web Push PWA  
