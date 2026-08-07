# Progress log

A running record of what changed, what it fixed, and what is actually
blocking Zakai — kept so the next session (human or agent) starts from the
truth rather than re-deriving it.

Newest first. Keep entries short and factual. If a claim cannot be pointed at
a file, a test, or a merged PR, it does not belong here.

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
