# יומן החלטות ופשרות — זכאי (Zakai)

יומן קצר של החלטות אמיתיות שהתקבלו תוך כדי הבנייה, לא רק תיאור הקוד. נכתב באנגלית לנוחות הקוד־בייס, עם מונחי המפתח בעברית.

---

## Stage 1 — Scaffold (Next.js + TS + Tailwind + i18n)

- **Framework:** Next.js 15 App Router + TypeScript + Tailwind v3. Chose Tailwind v3 over v4 for stability with the current toolchain.
- **i18n:** `next-intl` v3.26. The installed line is v3, not v4, so I dropped the v4-only `hasLocale` helper and use a local `isLocale` type guard (`src/i18n/config.ts`). Locale prefix is `as-needed` — Hebrew (default) is served at `/`, others at `/en`, `/ar`, `/ru`.
- **Languages from day one, not features:** all four locales are wired into routing and the request pipeline. Only `he` + `en` are *active* (shown in the switcher); `ar`/`ru` ship as brand-only stubs and **deep-merge over the Hebrew catalog** (`src/i18n/request.ts`) so a partially-translated locale never crashes on a missing key. Adding a language is a translation task, never a rewrite (spec requirement).
- **RTL:** direction is derived per-locale (`dir` map) and set on `<html dir>`. Verified at runtime: `/` → `dir="rtl"`, `/en` → `dir="ltr"`.
- **Design tokens:** ported the prototype's palette into Tailwind theme + a small set of global CSS utilities (`.grad-text` reserved for the savings moment; ambient blobs). **`prefers-reduced-motion` is honored globally in `globals.css` from the first commit**, not bolted on later (spec requirement).
- **Fonts:** `next/font` with Heebo (body) + Suez One (display), both with Hebrew subsets, self-hosted by Next so there is no runtime call to Google Fonts.

### Pending decisions carried forward
- The prototype called the Anthropic API **directly from the browser** with the key in client code. That is a non-starter for a real product (key exposure, no auth, no audit trail). Stage 3 moves all AI calls server-side.
- The prototype persisted to a `window.storage` demo store. Stage 2 replaces this with Postgres + real auth.

---

## Stage 2 — Database + real auth

- **DB:** Prisma + PostgreSQL 16 (local instance on port 5433 for dev/test). Schema in `prisma/schema.prisma`, migration `init` applied.
- **Money as integers:** every monetary value is stored and computed in **agorot** (1 ₪ = 100), never as a float. This makes the 18% fee arithmetic exact and testable. `src/lib/money.ts` + `src/lib/fee.ts`.
- **Auth is real, not demo storage:** email/password with bcrypt hashes (`src/lib/auth/password.ts`) and a signed-JWT httpOnly session cookie via `jose` (`src/lib/auth/session.ts`). Replaces the prototype's `window.storage`. Login returns the same response for "no such user" and "wrong password" to avoid user enumeration.
- **Phone captured at signup** and normalized to E.164 (`src/lib/phone.ts`); it is the anchor for ownership verification later.
- **Trust tables designed append-only:** `SavingsProof` and `Fee` are written once per case; `recordSaving` guards against double-settlement. `Authorization` carries an immutable issued document. These are the audit spine of the fee model.

## Stage 3a — The two priority verification mechanisms

The spec calls these the single most important thing to build **before any expansion**, so they are hard gates, not UI decoration.

1. **Account-ownership verification (SMS OTP).** `src/lib/services/ownership.ts`: a 6-digit code, **hashed at rest** (only the plaintext in the SMS/Outbox), 10-min expiry, 5-attempt cap, 30s resend cooldown. Verified live: wrong code rejected, correct accepted, single-use, expiry + attempt-cap enforced (unit + DB integration tests).
2. **Provider-facing authorization document (ייפוי כוח).** `src/lib/services/authorization.ts`: a formal power-of-attorney-style record with a **unique, human-verifiable code** (`ZK-XXXX-XXXX`, Crockford alphabet, no ambiguous chars, ~10¹² space). Rendered as a print-ready white "paper" document at `/authorization/[code]`, and independently checkable by the provider at a public `/verify` page that masks PII. The code + verify link are appended to every outreach email.

- **Decision — modeled on an existing, recognized format** rather than inventing one: the document reads like the ייפוי כוח a carrier rep already knows from the insurance/pension world, because a suspicious Israeli rep is more likely to honor a familiar format (per the research notes in the build prompt).
- **Decision — PDF vs HTML:** shipped the authorization as a **print-ready HTML document** (real bidi/RTL, selectable, `window.print()` → PDF) plus a verifiable public URL, rather than a pdf-lib file. Rationale: pdf-lib has no bidi engine, so correct Hebrew RTL in a generated PDF is a real project on its own; an HTML sheet gives correct RTL today and prints to PDF. A server-generated PDF attachment is logged in BACKLOG.

## Stage 3b — Core flow, end-to-end and verified in practice

- **AI moved fully server-side** (`src/lib/ai.ts`); the key never reaches the browser (the prototype exposed it). Image OCR requires a real key and **degrades honestly** (`aiUnavailable` → manual entry) rather than fabricating a reading. Recommendation/outreach has a deterministic **template fallback** that is clearly labeled `source: "template"`, frames figures as illustrative estimates, and contains no "expert"/"guaranteed" language (DoNotPay/FTC lesson).
- **Outreach language is Hebrew regardless of UI locale** — the provider reads Hebrew. Provider brand names use their real Hebrew names server-side (`providerHebrewName`).
- **Messaging is pluggable and logged** (`src/lib/messaging.ts`): with no SMTP/SMS configured, email and SMS land in the `Outbox` table and nothing leaves — the whole flow is testable in dev, and there is an audit record of every outbound message either way.
- **Verified live (curl against a running build):** signup → analyze → approve (per-request consent, timestamped) → ownership OTP → authorization doc → outreach email (with disclosure footer + code + verify link in the Outbox) → record saving → fee. Fee checked live: 25 ₪ saving → **4.50 ₪** (18% of 2500 agorot = 450 agorot). Public verify endpoint returns ACTIVE with masked phone.
- **Adversarial checks passed:** cross-user access → 404 on every case route; unauthenticated analyze → 401; double-settle → 409; premature send → `OWNERSHIP_REQUIRED`; send with ownership but no doc → `AUTHORIZATION_REQUIRED`; weak password / invalid phone / duplicate email all rejected.
