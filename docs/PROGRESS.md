# Progress log

A running record of what changed, what it fixed, and what is actually
blocking Zakai — kept so the next session (human or agent) starts from the
truth rather than re-deriving it.

Newest first. Keep entries short and factual. If a claim cannot be pointed at
a file, a test, or a merged PR, it does not belong here.

---

## Session — 2026-08-12

### The founder used the app and found three holes in one sitting

None of them were reachable by the unit suite, and none showed up in a
screenshot. All three were the same shape: the page rendered perfectly, and
you could not go on.

**The flight claim.** After the questions produced "you are owed ₪2,390", the
form was hidden behind a second button, and once opened it offered two
near-identical CTAs — one named after our own machinery ("open a case,
continue in the dashboard") — under a wall of grey text, with the install
banner sitting on the route field. The airline was a free-text box feeding a
Latin-only resolver, so "לופטהנזה" left the submit button dead with nothing
saying why. Now: form follows the result directly, airline is picked from a
list, one button reading "File the claim with El Al — ₪2,390".

**Image upload.** The bill extractor only ever asked whether an image could be
*read*, never whether it was a bill, so a legible non-bill with a number on it
opened a case. The statement-screenshot reader returned the model's reply
verbatim into the box holding the user's own transaction data — a photo of
anything else put a sentence of model prose there and scanned it. Both now go
through pure, tested interpreters (`interpretBillExtraction`,
`keepTransactionRows`); five of the nine new assertions fail against the old
code. The three extractions whose output is a sum of money that binds somebody
moved to the larger model.

**"Coming soon" for shipped features.** Printed under the button that prepares
a full statutory demand: "coming soon: Zakai will prepare the full demand for
you." Same for the coupon vault, live at `/coupons`. `comingSoonHonesty.test.ts`
is now a register — every "coming soon" needs a written reason it is still true.

### flowSweep — the check that finds this class

`scripts/flowSweep.mjs` (`npm run verify:flows`) asks the browser who is at
each control's coordinates. Three false-positive sources had to be eliminated
before it was trustworthy: flex-wrapped links (bounding-box centre falls
between the lines), sticky chrome (content scrolling under a header is what
sticky means), and closed `<details>` (Chrome hands out full geometry for
`content-visibility: hidden`). Proven to fail against the previous code before
being believed.

Signed out: 136 routes, 0 unreachable. **Signed in: 296 unreachable controls
across the first 36 routes**, all of them the push-notification banner, which
appeared four seconds after any signed-in page load over whatever was beneath
it — on the homepage, "start with my money". Both bottom-fixed banners now
share `useFloatingClearance`, which measures rather than guesses. After the
fix: 136 signed-in routes, 0 unreachable.

The sweep also briefly reported "ok, 0 controls" on nine routes while a stale
server served chunks from an old build. A page with no interactive elements
now fails outright — silence and success are not the same result.

### The fine print

2,091 text sizes across the app; 1,704 of them (81%) were 15px or smaller, and
the single most common size in the product was 13px, used 668 times. All 668
moved to the `body` token, which moved to 14.5px. No text clipping across 136
routes, 0 WCAG 2.1 AA violations, ad-hoc-size ratchet down from 2,104 to 1,423.

Also: first paint cut 45% (1520ms → 840ms on `/he`) by dropping a Heebo weight
with zero uses and un-preloading the wordmark face.

### The nineteen dead ends, and what they actually were

`scripts/deadEndBaseline.json` lists nineteen tool pages a person can arrive
at believing they are owed money and leave holding arithmetic. Measured page
by page on a phone, most of them were not missing a next step. **The next
step was there, written by somebody who knew the answer, rendered as the
smallest type on the screen.**

The reserve-duty calculator is the clearest case: it names בל/501 for the
employer's reimbursement, בל/502 for a personal claim after three weeks, and
the 3010 certificate that grounds either — five bullets of 13.5px grey under
a large green number, which is where the eye goes last.

`NextStep` (`src/components/NextStep.tsx`) is the fix: a heading, numbered
lines at body size, one full-width action. Wired into eight pages that had no
prominent path at all — advance-tax (gov.il form 2216א), complaint-escalation
(the regulator it already picked), school-payments (the Ministry of Education
circular), miluim / maternity / unemployment (the Bituach Leumi forms),
scam-check (three safety steps plus `/duplicate-charge`, a real claim, for
somebody already charged), overtime-backpay. Every URL was already carried in
`src/lib`. None were invented.

**A real bug found by driving a tool to completion:** the advance-tax page
displayed "43,089,291 days left to file" as fact. The date arithmetic is
correct; the tax-year field was an unbounded number box, and every figure on
the page derives from it. Clamped, with tests.

**The check was also wrong.** CLAUDE.md says a page gets "letter / check /
external official tool" and the dead-end rule only counted the first two, so a
page whose correct answer is a government form read as a dead end. Fixed. The
count still says 19, because the check reads each page as it loads and several
of these reveal their next step only once used. The baseline file now records
that explicitly: 19 is not the number of broken pages, and nobody should bolt
an internal link onto a page whose right answer is gov.il to make it move.

### Still the blocker

Without SMTP no ownership can be verified, so no case can be SENT, so no
SavingsProof and no Fee can ever exist. Everything above is polish on a loop
that cannot close. Nineteen routes still let somebody arrive believing they are
owed money and leave holding arithmetic (`scripts/deadEndBaseline.json`).

---

## Session — 2026-08-06/07

### The finding that reframed everything

For most of Zakai's life the test suite was green and nobody could use the
product. Both were true at once, and that is the important part.

The signup screen's submit button was `disabled` whenever the terms checkbox
was unticked — and that checkbox sits under a collapsed `<details>` most
people never open. Filling the entire form and tapping "sign up" did nothing
at all: no error, no hint, no reason. Real people, including the founder's
family, concluded the product was broken. They were right.

The first fix for it was also wrong, and shipped: the handler set a translated
error that could never run, because the checkbox carried `required` and native
constraint validation aborted the submit before `onSubmit` was reached. Tests
passed. CI passed. The button still did nothing.

Both were found the same way — by building the app against a real database and
opening it in a real browser. Neither is reachable by any unit test, because
the defect lives between the browser and the code, which is exactly where the
user stands.

### What shipped (PRs #133–#142, all merged)

| Area | Change |
|---|---|
| Signup | The dead-click, and then the dead fix behind it (#133, #134) |
| Agent CTAs | 21 verticals + `CheckFlow` now name the field they are waiting for, instead of presenting an inert button (#138) |
| Verification | `scripts/verify-loop.mjs` walks signup → scan → case in a real browser (#135) |
| Verification | `scripts/verify-buttons.mjs` clicks every control on every discovered page (#138, #139) |
| Business | Card-clearing fee vertical — the recurring cost small Israeli businesses never renegotiate (#136) |
| Business | `/late-payment`, `/advance-tax`, `/vat` surfaced in the hub they were missing from (#137) |
| Honesty | Nine borrowed facts (VAT rate, deposit deadline, tariffs…) now carry an age, a source, and a build-breaking leash (#141) |
| Accessibility | `/cancel`'s eight placeholder-only controls given real names (#140) |
| Reliability | A failed assistant question can be retried without retyping — or re-photographing a bill (#142) |
| i18n | Footer nav moved out of hardcoded locale ternaries; six per-build `FORMATTING_ERROR`s removed (#133, #137) |

### What improved, measurably

- Unit suite: **2126 passing**, 46 skipped.
- Guards added that fail the build rather than trusting anyone to remember:
  agent-CTA hints, link integrity across three navigation registries (176
  hrefs), small-business hub links, dated-fact freshness.
- Every guard was verified in both directions — proven to fail on a
  deliberately broken input, then to recover. A guard nobody has watched fail
  is a guard nobody should trust.

### A lesson worth keeping

Widening the button audit from 18 hand-listed pages to all 114 produced eighty
findings. **All of them were wrong.** A dev server compiling a hundred routes
on demand fell behind, and the script read every timeout as a dead link. Two
were checked by hand and both pages existed.

None were reported as bugs. The tool was fixed instead: reachability now
answers ok / dead / **unknown**, and a run that loses its server exits saying
it proves nothing. A tool that cries wolf at that volume is worse than no
tool, because the real findings end up buried under noise nobody will dig
through.

The same thing happened twice more at smaller scale — a wrong CSS selector, an
incomplete hint-detector word list. Each time the tool was wrong, not the
product. Check before reporting.

---

## Current bottlenecks

Ranked by the app's own `src/lib/monopoly/gravityLoop.ts`, not by opinion.

1. **`SMTP_HOST` / `USER` / `PASS` are unset.** Priority 1, `blocksMonopoly:
   true`. Without outbound mail nothing leaves the Outbox: a user completes the
   entire flow and the letter sits `QUEUED` forever. **This is the difference
   between a demonstration and a product**, and no amount of code changes it.
2. **No custom domain.** A money app asking for an ID number from
   `*.vercel.app` will not be trusted, and mail providers require a domain you
   own before they will let you send as it. So this gates (1).
3. **`ANTHROPIC_API_KEY` unset.** Zakai does not break without it — it falls
   back to templates in 13 places, honestly labelled. But the OCR, the
   negotiation strategy and the contract reader are all degraded.
4. **`PAYMENT_PROVIDER` unset.** Deliberately *not* urgent: the same file marks
   it `priority: 99, blocksMonopoly: false` — *"checkout without Mandate volume
   is SaaS."* Do not spend here before (1).

Everything above is a credential or an account. None of it is engineering.

## Next recommended actions

1. Set SMTP, then run `node scripts/verify-loop.mjs` against production and
   confirm a real letter actually arrives. Do not call the loop working until
   an email has been received by a human.
2. Have one real person complete one loop end to end. Zero have. Until that
   happens, every other metric is theoretical.
3. Convert calculator-only tools into agentic verticals — 29 of 91 catalog
   entries currently open a real Case. `/price-protection`, `/landlord-repairs`
   and `/train-delay` map closely onto existing pack shapes.
4. Aggregate `StrategyOutcome.variantId` into a per-counterparty win rate.
   The data is already being written and nothing reads it; this is the one
   asset that compounds with volume and cannot be copied.
5. Run `verify-buttons.mjs` against a **production build** (not a dev server)
   to get a trustworthy pass over all 114 pages.

## Where the plan lives

Deliberately not repeated here. Product vision, architecture, monetization and
success metrics already have homes, and a duplicate would drift out of sync
with them within a week:

- `CLAUDE.md` — the operating rules and the decisive filter
- `docs/INFRASTRUCTURE_DOCTRINE.md` — product law
- `docs/INDISPENSABILITY_STRATEGY.md`, `docs/MONOPOLY_FIVE_DOMAINS.md` — stages and tracked domains
- `docs/BILLIONS_SCALE_ARCHITECTURE.md` — scale architecture
- `docs/EXCELLENCE_SCORECARD.md` — what "done well" means and where to verify it
- `docs/IL_REVENUE_PLAYBOOK.md` — monetization
- `docs/LOCAL_LOOP.md` — how to run and prove the loop
