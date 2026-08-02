# Bank / fintech — inbound reply kit (not cold outreach)

Use **only when they wrote first** (inbound from `/institutions`, email, or a partner intro).
Zakai does not cold-call banks. See `docs/INBOUND_INSTITUTIONS.md`.
All links point at production or your custom domain.

## Subject (English)

`Consumer AI agents — verify authority in 30 minutes (no money-movement scopes)`

## Subject (Hebrew)

`סוכני AI לצרכן — אימות הרשאה ב-30 דקות (בלי היקפי העברת כסף)`

## Body (English)

Hi {{name}},

Zakai publishes an open **Mandate** format: scoped, signed, revocable consumer-agent authority that your systems can verify **without** calling us on every request.

Why teams adopt it:

- **Fail-closed verification** — JWKS + trust registry + live revocation feed  
- **Forbidden outbound payment scopes** — enforced in code, not policy PDFs  
- **Worst case of a bad mandate** = unwanted correspondence, not an emptied account  

**Start here (public, no login):**  
https://zakai-3uxj.vercel.app/en/integrations

**Machine-readable:**  
- Discovery: `/.well-known/zakai-mandate.json`  
- Registry: `/.well-known/zakai-trust-registry.json`  
- Deploy readiness: `/api/network/readiness`  
- Vertical map: `/api/network/opportunity-map`

**For AI platforms:** `zakai-mandate-mcp` (verification-only MCP; trust registry enforced).

Happy to run a 20-minute technical walkthrough on verify + decide + revocation.

{{your_name}}

## Body (Hebrew)

שלום {{name}},

זכאי מפרסמת פורמט **Mandate** פתוח: הרשאת סוכן צרכן מוגבלת, חתומה, ניתנת לביטול — שאפשר לאמת **בלי** לקרוא אלינו בכל בקשה.

למה מוסדות מאמצים:

- **אימות fail-closed** — JWKS + trust registry + feed ביטולים  
- **אין היקפי העברת כסף החוצה** — בקוד, לא רק במסמך  
- **מקרה גרוע של מנדט גרוע** = התכתבות לא רצויה, לא ריקון חשבון  

**התחלה (ציבורי):**  
https://zakai-3uxj.vercel.app/he/integrations

**לסוכני AI:** `zakai-mandate-mcp` — אימות בלבד, עם registry.

אשמח ל-20 דקות טכניות על verify / decide / revocation.

{{your_name}}

## Follow-up (if no reply in 5 days)

Short bump with one new fact — e.g. link to a real outcome on `/companies/{{provider}}` or the savings wall `/he/proofs`.

Do not promise regulatory approval or claim Zakai files with regulators on the customer's behalf.
