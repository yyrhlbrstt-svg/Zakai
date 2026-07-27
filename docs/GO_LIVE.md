# Zakai — go-live (solo)

## 1. AI (assistant + bill OCR + screenshots)
Set **one** of:
- `ANTHROPIC_API_KEY` (preferred)
- or `DEEPSEEK_API_KEY`
- or `GEMINI_API_KEY`

Optional: `ANTHROPIC_MODEL`, `GEMINI_ASSISTANT_MODEL`

## 2. Mandate keys (already partially set)
- `MANDATE_SIGNING_JWK`, `MANDATE_SIGNING_KID`
- `MANDATE_ISSUE_KEY`, `MANDATE_REVOKE_KEY`

## 3. Real fee collection (optional until first paid saving)
Default is **mock** (works end-to-end, no real money).

For PayPlus:
```
PAYMENT_PROVIDER=payplus
PAYPLUS_API_KEY=...
PAYPLUS_SECRET_KEY=...
PAYPLUS_PAYMENT_PAGE_UID=...
# optional sandbox base:
# PAYPLUS_BASE_URL=https://restapidev.payplus.co.il/api/v1.0
```

Test in **sandbox** before live charges.

## 4. Product loop to verify after deploy
1. `/money` — screenshot or paste charges
2. `/check` — analyze → approve → ownership → auth → send
3. Dashboard SENT — follow-up draft → record new amount
4. SAVED — WhatsApp share + fee pay button if PENDING

## 5. Not required for solo launch
- Bank contracts
- Call center
- Open Banking (later)
