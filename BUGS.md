# BUGS.md — S1 bug hunt (demo-readiness sprint)

*Hunted 2026-08-20 against the production build (`next build` + `next start`),
using the repo's sweep battery plus a dedicated demo-path crawl. Every claim
below is a measurement; fixes carry their evidence. Severity: P0 breaks or
embarrasses · P1 looks unprofessional · P2 logged, not fixed this sprint.*

## What was hunted (methodology + coverage)

| Sweep | Coverage | Result |
|---|---|---|
| `verify:routes` (390px, overflow + dead-end ratchet) | 137 routes | **No hard failures**; dead-end baseline 16, unchanged |
| `a11y` (axe, WCAG 2.1 AA, 390px) | 137 routes | **Zero violations** |
| `verify-buttons` (every interactive element) | 121 pages | 15 findings → 2 INERT (fixed, P1), 13 SELF_LINK (P2) |
| `verify-first-screen` | 10 entry routes | 10/10 open with something to do |
| `flowSweep` + `verify-journey` (interactions, money loop) | all tool routes + 13 journey steps | 12/13 unaided; 1 finding (P1-investigate below) |
| Demo-path console crawl (new): he/en/ar/ru/de/fr × home, how-it-works, money, start, pricing, cancel @390×844 | 36 page-loads | **Zero console errors, zero pageerrors, zero HTTP≥400, no MISSING_MESSAGE, no placeholder text, no English-leak runs on Hebrew pages, no horizontal overflow** (only benign Next.js prefetch-abort noise) |

## P0 — found and FIXED in this pass

### P0-1: Personal gmail rendered on public pages
The founder's personal gmail was **visible text** on `/he/contact` (raw
address line), `/he/privacy` ("לשאלות פרטיות ולמימוש זכויות: yyr…@gmail.com"),
`/he/trust` ("לפנייה: yyr…@gmail.com"), and embedded in the Organization
JSON-LD on **every page** (which Google indexes as the company's address).

**Fix (keeps every enquiry path alive — hiding the text never discards the
mail):** `configuredSupportEmail()` / `configuredSecurityEmail()` in
`contact.ts` return an address only when a real mailbox is configured via
env. Pages print an address only then; otherwise they render a labeled
mailto link ("שליחת מייל") whose `href` still reaches the fallback inbox.
JSON-LD includes `email` only when configured — the contact-page URL is
always present. The unused (imported-by-nothing) `FooterSupportLink`
component that printed the raw address was deleted.
A fourth site surfaced during verification: **`/he/money` — a demo-path
page — printed the gmail as the proofs-forwarding address** in the
"כשהבנק או הספק עונים במייל" hint. Fixed the same way: with no configured
proofs inbox, the hint leads with the paste-in-dashboard path (which fully
works) and prints no address; `configuredProofsInboundAddress()` restores
the forwarding line the moment a real inbox is configured.
**Evidence:** post-fix curl of `/he`, `/he/contact`, `/he/privacy`,
`/he/trust`, `/he/money`, `/he/pricing`, `/he/start` → zero visible gmail
text on all seven (addresses remain only inside functional `mailto:`
hrefs). When the founder configures `NEXT_PUBLIC_SUPPORT_EMAIL` /
`NEXT_PUBLIC_PROOFS_EMAIL` on a real domain, printed addresses reappear
automatically — no code change needed. Remaining by design: the logged-in
dashboard's proofs box still shows the forwarding address to the case
owner (it is the instruction for a real action there) — logged as P2 to
revisit when the domain mailbox exists.

### P0-2: `/status` hard-coded claims — checked, NOT a bug
`/status` renders from `serviceStatus.ts`, measured per request,
`force-dynamic`. No hard-coded green found. (Verified in the Phase-0 audit
and re-confirmed.)

### P0-3: Fabricated metrics — checked, none found
`claimsHonesty.test.ts` ratchets copy in CI; the demo-path crawl found no
placeholder text; empty aggregates render designed zeros (doctrine +
existing tests). No seeded or fake number found on the demo path.

## P1 — found and FIXED in this pass

### P1-1: Two dead-looking primary CTAs
`/he/contract-check` ("בדקו את החוזה") and `/he/spending` ("תראה לי לאן
הכסף הולך") rendered their primary button **disabled with no reason on
screen** — to a non-technical user, a button that does nothing.
**Fix:** both buttons are now always enabled; an empty/too-short click shows
the existing designed inline Hebrew hint (contract: "הדביקו לפחות כמה
שורות…"; spending: the designed empty-state message) instead of silence.

## P1 — logged, needs investigation (not closed)

### P1-2: Journey step "record a saving from the screen" wrote no proof
`verify-journey` reports the control renders but no SavingsProof row was
written in this environment. May be environment-dependent (the same script
flags the ownership-email step as provable only via Outbox without an SMTP
sink). **Next step:** run with `scripts/dev-smtp-sink.mjs` + `ZAKAI_MAILDIR`
per the script's own instruction and determine real vs. environmental.
Blocking for S4 sign-off, not for S2.

## P2 — logged, deliberately not fixed this sprint

1. **13 SELF_LINK findings** — pages whose nav/footer link to the page
   itself (e.g. `/he/status` → `/he/status`). Cosmetic; harmless.
2. **16 dead-end tool pages** (ratcheted baseline in
   `scripts/deadEndBaseline.json`) — every one has a verified
   interaction-gated next step the crawler cannot see; the baseline may only
   shrink. None are on the demo path.
3. **ar/ru (12%) and de/fr (8%) locale coverage** — most strings fall back.
   A product decision (finish / stage as beta / drop from switcher) is
   flagged in DESIGN-AUDIT.md §6; the demo is Hebrew, so not sprint-blocking.
4. **Middleware bundle 421 kB** — investigate what rides in it (likely
   i18n tables); performance work belongs to S3's Lighthouse pass.
5. **JSON-LD Organization block** still names the Vercel preview domain as
   canonical `SITE_URL` — correct until a custom domain exists (founder).

## Known founder-only items surfaced by this hunt (no code fix possible)

- `NEXT_PUBLIC_SUPPORT_EMAIL` / `SECURITY` on a real domain — flips every
  labeled contact link back to a printed address.
- SMTP credentials — without them, "SENT" stays honest-but-queued
  (the UI already says so; the flow sweep's one unproven step is this).
- Custom domain for the app itself (zakai-3uxj.vercel.app is what WhatsApp
  previews will show — S3 will polish the card, but the domain is the
  founder's move).

---

*S1 exit state: all P0s closed or verified-not-bugs; P1-1 closed; P1-2 under
investigation with a named reproduction path; P2s logged. Full suite, tsc,
and production build green after the fixes (evidence in the PR).*
