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

---

## גל רעיונות חדש — ערך × מאמץ

### 🟢 לבנות בקרוב (מתלבש על הקיים)

1. **Overnight Agent**  
   כפתור אחד בדשבורד: "הכן follow-up לכל התיקים ב-SENT". מייצר טיוטות במקביל לפי playbook. ללא שליחה אוטומטית — המשתמש מאשר/מעתיק. סוגר את תחושת "הסוכן עובד בלילה".

2. **Household / מצב משפחה v1**  
   כבר יש `beneficiaryLabel`. להוסיף UI: "הוסף חשבון של אמא/סבתא" → תיקים מתויגים + סיכום משפחתי אחד. מכפיל ARPU בלי משתמש חדש. בלי גישה לחשבון של צד ג' — רק תווית + טיוטות בשם המשתמש המורשה.

3. **Zakai Wrapped (שנה עם זכאי)**  
   דף `/wrapped` שנתי: כמה תיקים, כמה נחסך, כמה פעמים הסוכן פעל, דירוג מול ממוצע. שיתוף WhatsApp מוכן. ויראלי כמו Spotify — על בסיס `SavingsProof` שכבר קיים.

4. **Public SavingsProof wall (אנונימי)**  
   פיד ציבורי: "השבוע נחסכו ₪X על ידי N משתמשים" + כרטיסים אנונימיים ("סלולר · ₪47/ח׳"). אמון + SEO + FOMO. רק סכומים מצרפיים — בלי PII.

5. **Mandate QR**  
   בדף `/authorization/[code]` — QR שמפנה ל-verify + JWKS. הספק סורק במקום להקליד קוד. אמון מוסדי.

6. **Batch open from scan**  
   אחרי סריקה: "פתח את 3 התיקים הכי כדאיים" בלחיצה אחת (עד מגבלת התוכנית). Money Hub כבר מציג best ROI — להרחיב ל-top N.

7. **Competitor-in-hand במשא ומתן**  
   ב-CaseNextStep כשבוחרים `competitor`: שדות שם+מחיר → מוזנים ל-`buildFollowUp`. כבר קיים ב-negotiation.ts — לחשוף ב-UI.

8. **Document vault**  
   `/documents`: רשימת Mandate + מכתבים + SavingsProof להורדה/הדפסה. חותמת זמן. מחזק תחושת "יש לי תיק מסודר".

### 🟡 דורש תשתית / רגולציה

9. **Forward-email inbox**  
   המשתמש מעביר מייל מהספק ל-`cases@zakai…` → AI מחלץ סכום חדש → מציע "רשום חיסכון". סוגר הוכחה בלי Open Banking. דורש inbound email (SendGrid Inbound / Cloudflare Email).

10. **Web Push ב-PWA**  
    "הספק ענה? / הגיע זמן recheck". iOS 16.4+ תומך. דורש VAPID + service worker.

11. **טיסה כ-Case מלא**  
    EU261 / חוק שירותי תעופה → createCase(vertical=airline) + Mandate + מעקב. ה-checker קיים.

12. **B2B embed widget**  
    `<script src="zakai.app/embed.js">` לבנקים/פינטק — "בדוק זכויות ללקוח". הכנסה B2B מהיום-הראשון אחרי ישות.

### 🔴 לא בונים (קווים אדומים)

- בוט שמאיים בתביעה / מייצג משפטית  
- ניטור כרטיס אשראי של צד ג' בלי הסכמה מפורשת  
- הבטחות "טריליון" כמטריקת מוצר — רק כחזון פנימי; החוץ: מוביל קטגוריה + ARR אמיתי

---

## סדר ביצוע מומלץ (השבועיים הקרובים)

1. Overnight Agent (follow-up batch) — יום  
2. Competitor fields ב-UI — חצי יום  
3. Mandate QR — חצי יום  
4. Household label UI — יום  
5. Wrapped skeleton — יום  
6. Public proof wall (מצרפי) — יום–יומיים  

הכל בלי תלויות חיצוניות חדשות. אחרי זה — inbound email / push / airline Case.
