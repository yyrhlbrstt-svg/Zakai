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

## Fix — root ("/") returned 404 on Vercel

- **Symptom:** the bare domain returned Vercel's platform-level `404: NOT_FOUND` before any language path, while `/he` worked. It worked under local `next start`.
- **Cause:** with `localePrefix: "as-needed"` the default locale (Hebrew) was served unprefixed at `/` via an internal rewrite to the `[locale]` route. `next start` resolves that rewrite dynamically, but on Vercel the unprefixed default route has no entry in the platform routing table, so `/` fell through to a platform 404. (Confirmed the compiled middleware matcher *does* match `/`, ruling out the matcher itself.)
- **Fix:** switched to `localePrefix: "always"` (`src/i18n/routing.ts`). The root is now a plain **307 redirect** to `/he` (locale-negotiated; defaults to Hebrew) — a route that genuinely exists — instead of an internal rewrite to an unprefixed path. The user never types `/he`; the browser lands on it automatically.
- **Verified against a production build (`next build` + `next start`, same output Vercel runs):** `/` → 307 → `/he` (and → `/en` for an English `Accept-Language`), following the redirect yields 200 with the Hebrew RTL hero; `/he`, `/en`, `/he/login`, `/he/verify` all 200. Crucially, unprefixed links in outreach emails (`/verify?code=…`, `/authorization/CODE`) 307 to their `/he/…` equivalents **with the query string preserved**, so provider verification links keep working.

## Design pass — restrained premium polish (user-approved subset)

Scope was deliberately limited to the calm, on-brand set the user approved; explicitly **no** GSAP/Three.js/WebGL/aggressive kinetic type (they fight the "relief, not celebration" tone, reduced-motion, and mobile perf). All dependency-free.

- **One committed accent — emerald.** Cyan/violet demoted to rare accents; the tri-colour signature gradient is now reserved for the savings moments only (hero accent line, the savings figure, the brand wordmark). Retuned CTAs, inputs-focus, slider, background blobs, dropzone, links, and step indicator to emerald (`globals.css` tokens + component sweeps).
- **Motion tokens** (`--ease-out/-snappy/-spring`) applied to existing transitions (buttons, inputs) — better timing on what already existed, not new motion.
- **Subtle spotlight** on the existing glass cards (`SpotlightCard`): JS only writes `--mx/--my`, the compositor paints a low-alpha emerald radial glow. No animation loop, no deps.
- **Restrained scroll-reveal** (`Reveal`): small fade+rise via IntersectionObserver, staggered, `.js`-gated so no-JS keeps content visible, and forced visible under reduced-motion. Verified live: all reveal nodes reach opacity 1 on scroll.
- **Savings-moment polish** (`FallNumber`): the amount now settles from the old figure down to the new one (ease-out cubic, "weight lifted"), with the old amount struck through above it; reduced-motion shows the final number instantly.
- **Hebrew/RTL correctness pass:** removed `letter-spacing`/`uppercase` from Hebrew UI labels (both harm Hebrew letterforms / are no-ops), added `scrollbar-gutter: stable`, `text-wrap: balance` on the hero. Confirmed the codebase already uses logical properties (`ms-`/`ps-`/`inset-inline-*`/`text-start`/`text-end`) — no physical left/right to flip.
- **Verified visually** with headless Chromium at 1280px and 390px (desktop + mobile): emerald-dominant, tri-gradient only on savings moments, trust row above the fold, RTL layout correct (cards 1→2→3 right-to-left on desktop, stacked on mobile), no horizontal overflow. Tests 27/27, typecheck + build clean.

## Design pass 2 — fintech number discipline (from the 2nd design brief)

Adopted only the one unambiguous-correctness item from the second brief; explicitly declined the rest as diminishing returns / net-neutral (documented reasoning below).

- **Tabular figures + bidi isolation on money numbers.** Added `font-variant-numeric: tabular-nums` to the display face (every large money figure) so digits don't jitter as they animate/change and columns align — the Mercury/Ramp fintech discipline. Wrapped the changing numerals (the settling savings figure, the live calculator amount, the estimate range) in `dir="ltr"` isolation so `₪` + Latin digits render as one clean left-to-right run inside RTL text.
- **Declined — `animation-timeline: view()` replacing the IntersectionObserver reveal:** a lateral swap, not an upgrade. Our reveal already uses IO (no scroll listeners → no INP cost) and is reduced-motion/no-JS safe; Firefox stable still needs the IO fallback, so this would mean maintaining two code paths for an invisible change.
- **Declined — View Transitions on the flow:** the flow is in-component state, not routes, and already has calm per-stage fade-ins; VT here is gilding with manual reduced-motion babysitting.
- **Declined (per brief's own advice) — liquid glass, progressive blur, looping shimmer/gradient text, per-character kinetic type, cross-document transitions:** all clash with the calm tone and/or carry mobile-perf / RTL / single-engine risk.

## Fix — signup showed raw "auth.genericError"; password eye toggle

- **Root cause (two layers):**
  1. On a misconfigured deployment (no `DATABASE_URL`/`AUTH_SECRET`, or an unreachable DB) the signup/login handlers threw, so Next returned an unstructured 500. The client fell back to `setError("genericError")`.
  2. `AuthForm` looked error keys up in the **`auth`** namespace, but `genericError` lives in **`common`**. next-intl returns the raw key path for a missing key (it does not throw), so `try/catch` never fired and the string **`auth.genericError`** was rendered to the user.
- **Fix:**
  - `AuthForm.tErr` now maps only a known allow-list of keys into the `auth` namespace and sends everything else to `common.genericError` — **a raw key can never reach the UI** again, for any current or future error.
  - `signup`/`login` routes wrapped in `try/catch` → structured `500 {error:"genericError"}` (+ `console.error` so the real cause shows in Vercel logs) instead of an unhandled crash.
  - Added a **show/hide password** eye toggle (accessible `aria-label`/`aria-pressed`, RTL-correct at the inline-end).
- **Proven from a real user's-eye view (headless Chromium on the production build):**
  1. Misconfigured server (broken `DATABASE_URL`) → the form shows **"משהו השתבש. נסה שוב."** (Hebrew), assertion `contains raw key? false`.
  2. Eye toggle flips the field `password → text`.
  3. Correctly-configured server → full signup **lands on `/he/check`** end-to-end with a session cookie.
- **Still requires the operator (cannot be done from here):** the *live* signup will only succeed once `DATABASE_URL` + `AUTH_SECRET` are set on Vercel and `prisma migrate deploy` has run, and Vercel's Deployment-Protection 403 is lifted. My sandbox cannot reach the protected `*.vercel.app` host, so live E2E is the operator's step; the code-side blocker (raw key / crash) is fixed and proven locally.

## Ops — auto-migrate on Vercel build; AUTH_SECRET; protection still on

- **Auto-migrations:** `build` now runs `scripts/prebuild-migrate.mjs` before `next build`. It runs `prisma migrate deploy` **only when `DATABASE_URL` is set** (fails the build on migration error — better red than a runtime 500), and **skips cleanly when it isn't** (so a DB-less preview still builds). Verified both branches locally. Vercel runs `npm run build`, so no dashboard change is needed as long as the Build Command is left at its default.
- **Deployment Protection re-checked (unauthenticated, via WebFetch):** `/he` still returns **403** — protection is still ON; the site is not yet public. Must be disabled in Vercel settings.
- **AUTH_SECRET:** generated a fresh 48-byte base64 secret for the operator to paste into Vercel env (given in chat, not committed).
- **Direct DB migration from here is not possible:** the sandbox has no outbound egress to arbitrary hosts and I was not given the connection string; the build-time auto-migrate removes the need for it.

## Account name in header + basic settings screen (scoped: just these two)

- **Header now shows the logged-in user's name** as an account chip (emerald initial + name), which doubles as the entry point to `/settings`. The standalone header logout button moved into settings.
- **New `/settings` (`My account`) screen:** server component, auth-gated (redirects to login), shows name / email / phone (email + phone LTR-isolated for clean RTL rendering), plus a `LogoutButton` (client) that clears the session and returns home.
- Added `settings` message namespace + `nav.settings` (he/en).
- **Verified in a real browser (production build):** header renders the name; `/settings` shows the details and the logout button; clicking logout clears the session and lands back on `/he` with the header reverting to login/signup. Tests 27/27, typecheck + build clean.
- Deliberately scoped to exactly these two additions — no extra features, per request.

## Production-readiness slice — security, fee trust loop, Trust page (scoped to three)

Implemented exactly the three items the user approved from the gap-analysis brief; everything else went to BACKLOG by stage.

**1. Basic security hardening.**
- Security headers via `next.config` (`Strict-Transport-Security`/HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) — verified live on responses. TLS itself is host-terminated (Vercel); session cookie already `httpOnly`+`secure` in prod.
- **Secrets scan:** `.env` not tracked; no provider-token/private-key patterns in tracked files; secrets referenced only via `process.env`. Clean.
- **Dependabot** (`.github/dependabot.yml`) — weekly npm (grouped) + github-actions.
- **Rate limiting:** durable Postgres-backed fixed-window limiter (`RateLimit` table + `src/lib/ratelimit.ts`, migration `rate_limit`) on login (10/10min), signup (10/hr), OTP send (5/hr) and OTP verify (30/10min), keyed by client IP. Fail-open. Verified live: login allows exactly 10 then `429`.
- **Error monitoring:** native `instrumentation.ts` `onRequestError` → `reportError` (structured stderr → captured by Vercel Logs). Sentry-ready — auto-forwards if `SENTRY_DSN` is set and `@sentry/nextjs` is installed, via a runtime-assembled import specifier so nothing is added to the bundle/build. Auth 500s route through it.

**2. Fee trust loop.**
- `recordSaving` now emails the customer an automatic confirmation when a fee is charged: full breakdown (original → new → documented saving → 18% fee), a **14-day dispute window** (`FEE_DISPUTE_WINDOW_DAYS`), and a support contact. Verified live in the Outbox (120→90, saving 30, fee 5.40).
- Dispute policy documented on the Trust page and in the email; the mechanism in the MVP is the confirmation email + support channel (full in-app dispute + PSP refund are in BACKLOG).

**3. Public Hebrew Trust/Security page (`/trust`).**
- Sections: data security (7 concrete measures), the success-fee-only model, disputing a charge, and a security contact (`security@`), plus a footer link wired into the layout so it's reachable everywhere. he/en. Verified: `/he/trust` → 200 with the expected content.

Backlog updated with the full Stage-0/1/2 production-readiness list (account recovery, deletion/export, WCAG AA, DPO, SOC 2, insurance-licensing review, etc.), marking what's already done.
