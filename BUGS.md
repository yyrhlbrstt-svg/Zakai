# BUGS.md — full-site QA sweep

**Tree swept:** `eb6d5ec`, merged to `main` as `92704a8` mid-sweep (same tree).
**Date:** 2026-08-21 · **Build:** production `next build`, served locally · **Browser:** Chromium 141 via Playwright.
**Mandate for this pass:** audit and report only. Nothing was fixed while sweeping, including things that were
one line away from a fix.

---

## 1. What was actually measured

| Pass | Scope | Volume |
|---|---|---|
| 1 — page load | **every** route × **every** locale × 2 viewports | 137 routes × (6 locales @390×844 + he/en @1440×900) = **1,096 page loads** |
| 2 — interaction | 20 primary-flow pages × he/en @390×844: every button/link/tab in `main` (≤24 per page), plus every form submitted empty | **82 findings raised**, all re-verified individually |
| 3 — signed-in | a real account created through the real signup form, then 8 protected routes, a real case opened end to end, and all 24 dashboard controls | 1 account, 1 case |
| 4 — RTL | 14 pages × he/ar, plus a source sweep for physical-direction CSS | 28 page loads |

### Where I am flagging by eye rather than by assertion

Stated plainly, because the difference matters when deciding what to trust:

- **Pass 1 is exhaustive.** Every route, every locale, both viewports. Nothing sampled.
- **Pass 2 is not.** The full element × locale × viewport matrix is >10,000 interactions. It was scoped to the
  20 pages carrying the money path, in he and en. A dead button on `/de/vaad-bait` would not appear here.
- **Passes 2 and 4 are mechanical.** They prove a control did *something*; they cannot judge whether it was the
  *right* something. "Opens a case" is verified. "Opens the case a person expected" is not.
- **No visual diffing.** A layout that is ugly but not overflowing passes.
- **Nothing needing a production credential was exercised**: no mail left the system (no SMTP), no payment was
  taken (no PSP), no OCR ran on a real photo (no AI key here). Those paths are **untested**, not proven working.
- One finding below (`/results` fr) was **seen once and did not reproduce**. It is reported as unreproduced
  rather than quietly dropped or quietly promoted.

---

## 2. Findings

Sorted by severity, worst first. No P0 was found.

| Page | Locale | Viewport | Element | Expected | Actual | Console error | Severity |
|---|---|---|---|---|---|---|---|
| `/credit-card` | de, fr, ru | 390×844 | Interest result `₪{n}` — `CreditCardTool.tsx:46,48` | Server HTML and client render agree; no hydration error | `toLocaleString()` is called with **no locale argument**, so Node formats with its own default (`₪ 1,200`) and the browser formats with the *visitor's* locale (`₪1.200` on a German phone). React discards the server HTML and re-renders. Verified by diffing SSR bytes against the hydrated DOM: SSR `₪ 1,200` → live `₪1.200`. he/en/ar are unaffected only because their formats coincide with the Node default | `Minified React error #418 (args[]=text)` | **P1** |
| `/results` | fr | 390×844 | not isolated | No hydration error | One `#418 (args[]=HTML)` recorded during the exhaustive pass. A targeted re-run of the same URL, same locale, same viewport produced **zero** errors, and the SSR-vs-DOM diff came back clean. Cause unknown; possibly ISR-timing dependent | `Minified React error #418 (args[]=HTML)` — once, not reproduced | **P1, unconfirmed** |
| `/commitments`, `/score` | all 6 | both | page body, signed out | Either the content or a login screen — not content that then fails | Both render their **full page** to a signed-out visitor, then client-fetch APIs that correctly reject them. The person sees a real-looking screen backed by nothing. `/deadlines` does show a login screen but still fires the request first. Contrast `/dashboard`, `/settings`, `/documents`, `/activity`: clean login screen, no failed request. Signed in, all seven are correct with zero console errors | `Failed to load resource: 401` — `/api/commitments`, `/api/vigil/watch`, `/api/deadlines` | **P2** |
| `/flights` | he, en | 390×844 | "רק הכן מכתב להעתקה" / "Just generate letter to copy" — `FlightRightsChecker.tsx:425‑428` | Same behaviour as every other blocked button in the app: tapping it scrolls to the checklist and says what is missing | A raw `<button disabled>` that bypasses the shared `Button`. Measured: `disabled=true`, `opacity 0.45`, `cursor: default`; force-clicking changes scroll position by 0px and page text by 0 characters. It is the dead grey button the shared component was reworked to abolish — and the primary CTA directly above it on the same card *is* the answering kind, so the two behave differently side by side | none | **P2** |
| `/login`, `/signup`, `/contact` | he (and any RTL locale) | 390×844 | submit with empty fields | A message in the page's language | No in-page validation message. Every required field relies on the **native browser bubble**, whose language follows the browser UI rather than the page — it rendered `"Please fill out this field."` over a Hebrew form here. Only the first invalid field gets a bubble, and it disappears on scroll. Where the app validates *itself* it is correct and in Hebrew ("יש לאשר את התנאים למעלה", "חסר אימייל ליעד") — the gap is only the native-only fields | none | **P3** |
| `/protocol` | he, ar | both | `<ul className="m-0 pl-5">` — `protocol/page.tsx:125` | Indent on the start side | Measured in the browser: `direction: rtl`, `padding-left: 20px`, `padding-right: 0`, `list-style: none`. The gutter sits on the wrong side of an RTL list. `fairness-certified/page.tsx:50` carries the same class but did not render in this pass. `registry/page.tsx:79` also uses `pl-5` and is **not** a bug — that block is deliberately `dir=ltr` for machine-readable scope names | none | **P3** |
| `/bank-fees` | he | 390×844 | "4 ספרות אחרונות של החשבון" | Four digits, or a refusal | Accepts arbitrary text — `"בדיקה"` was submitted and the case opened with `200`. Nothing numeric is enforced client- or server-side on that field | none | **P3** |

---

## 3. What came back clean

Reported because a sweep that only lists complaints tells the founder nothing about what he can rely on.

- **1,096 page loads:** 0 responses ≥400 · 0 navigation failures · 0 horizontal overflow at 390px · 0 leaked
  translation keys · 0 near-empty `<main>`. Every one of the 137 routes renders in all 6 locales.
- **Interaction sweep: 0 dead buttons.** All 82 raised findings were re-visited one at a time and every one
  turned out to be the probe's fault, in three classes: 26 elements hidden inside a **closed `<details>`**
  (invisible to a person too), 12 **`aria-disabled` blocked-but-answering** buttons (Playwright refuses to click
  them; a finger does not — each was confirmed to flash the missing-fields checklist), and 44 clicks whose effect
  the probe could not see (a chip toggling `aria-checked`, an anchor scrolling, a `mailto:` with no mail client).
  he and en produced **identical** finding sets, 41 each — no locale-specific breakage.
  The single real finding above surfaced only on the *second* pass, when I re-checked the two rows my first
  classifier had wrongly credited as "did something".
- **The money loop works end to end, signed in.** Sign up → `/he/bank-fees` → fill → "פתח תיק" →
  `POST /api/cases/bank-fees 200` → `POST /api/cases/{id}/ownership/send 200` → redirect to
  `/he/money?case=…` with a live "המשיכו את התיק →". No console errors anywhere in that path.
- **Signed-in protected pages:** all 8 render real content with **zero** console errors. All 24 controls on the
  signed-in `/money` dashboard did something observable — navigation, scroll, or state.
- **Error handling is honest and in Hebrew** where the app owns it: an unusable outreach address returns 400
  `needsOutreachEmail` and the screen says "חסר אימייל ליעד — הזן כתובת תקינה."
- **RTL:** 14 pages × he/ar — `dir=rtl` correct everywhere, no LTR prose blocks, and the codebase uses logical
  properties almost throughout (3 `pl-5` occurrences in the entire tree, one of which is the P3 above and one of
  which is correct by design).
- **Chips are properly built**: `RadioChips` renders `role="radio"` + `aria-checked`. The chips that "did
  nothing" were the already-selected defaults (`jurisdiction: "il"`, `kind: "cancelled"`, `tier: "medium"`,
  `shortNotice: true`, `reason: config.defaultReason`) — clicking the selected option correctly changes nothing.

---

## 4. Related, found by reading rather than by clicking

- `src/app/[locale]/protocol/page.tsx:170` calls `toLocaleString()` with no locale — the same latent bug as the
  P1 above. It did not fire in this sweep (it is a server component and the value was 0), which is luck, not
  safety.
- Three other raw `<button disabled>` exist (`EnablePush`, `FeePayButton`, `TrackRecordCard`) and are **not**
  findings: all three are `disabled={busy}`, i.e. in-flight double-submit protection, which is correct.
