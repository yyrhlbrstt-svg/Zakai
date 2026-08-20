# DESIGN-AUDIT.md — Phase D0 of the Design & Code Quality Track

*Audited 2026-08-20 against the running production build (local `next start`,
137 routes swept at 390px). Every number below was measured on this codebase
today — nothing is estimated. Where a D0 requirement could not be measured in
this environment, it says so instead of guessing.*

**The single most important finding:** this is not a greenfield mess. Zakai
already has a partial design system with documented rationale, a ratcheted
type-scale migration in progress, sweep scripts running in CI, and — measured
today — **zero WCAG 2.1 AA violations across all 137 routes**. The D-track's
job is to *finish and consolidate* an existing system, not invent one. Any
plan that starts by replacing what exists will lose the ratchets and sweeps
that currently keep quality from regressing.

---

## 1. Surface inventory

| Metric | Value |
|---|---|
| Routes (`page.tsx` files) | 141 (137 render-swept; the rest are API-adjacent shells) |
| Components (`src/components/*.tsx`) | 183 |
| Locales | 6 (he primary, en, ar, ru, de, fr) |
| Theme | **Dark only, by design** — tailwind config: "relief, not celebration"; canvas `#070B12` |
| Fonts | Heebo (body, Hebrew+Latin — the exact free baseline the benchmark research recommends), Suez One (display), Manrope — all via `next/font/google` (self-hosted by Next automatically) |
| TypeScript | `"strict": true` already on |
| First-load JS | 102 kB shared; heaviest route ≈ 193 kB; middleware 421 kB |

## 2. What already exists (do not rebuild — finish)

- **Type scale**: 11 named steps in `tailwind.config.ts` (`micro`→display),
  each with a paired line-height and a written rationale (raised for Hebrew
  phone reading after counting 2,104 arbitrary sizes). A ratchet
  (`src/lib/typeScale.test.ts`, ceiling **1423**) freezes arbitrary-size
  count while the migration proceeds.
- **Named palette** in Tailwind: `bg/surface/surface-border/ink/ink-soft` +
  `emerald/cyan/violet/amber/danger`.
- **Quality rails in CI**: `verify:routes` (390px overflow + dead-end
  ratchet, baseline may only shrink), `a11y` (axe, WCAG 2.1 AA),
  `verify:first-screen`, `verify:flows`, jsxHygiene, claimsHonesty,
  orphanModules/orphanPages ratchets, plus 12 more `verify:*` suites.
- **RTL**: `dir` set on `<html>` per locale; the app is RTL-first in
  practice — only **4** physical-direction classes exist in the whole tree
  (29 logical-property usages); LTR runs like the wordmark are wrapped with
  `dir="ltr"`.
- **Observability**: `/api/health` route exists **with a test**; `/status`
  is measured per request (`serviceStatus.ts`), not hard-coded.
- **Honest-ledger enforcement**: `claimsHonesty.test.ts` ratchets copy;
  empty states render zeros as zeros (doctrine + tests).

## 3. Measured problems (the actual gaps)

Ranked. Counts are from today's scans.

### P1 — Arbitrary values are the real debt
- **2,987 arbitrary Tailwind bracket values** (`[#hex]`, `[Npx]`, `[rgba()]`)
  across components + app.
- **1,418 arbitrary text sizes** remain (ceiling 1423; started at 2,104 —
  ~33% migrated). Top offenders: `text-[13.5px]` ×227, `text-[12.5px]` ×216,
  `text-[12px]` ×190, `text-[15px]` ×178, `text-[14px]` ×171,
  `text-[11.5px]` ×132 — six near-identical sizes that the named scale was
  built to replace.
- **53 distinct raw hex colors** hard-coded in TSX (top: `#06121A` ×48,
  `#3EC6FF` ×27, `#3FCB9B` ×24, `#ff8f8f` ×19, `#F08A6B` ×19 — note
  `#3FCB9B`/`#3fcb9b` and `#F08A6B`/`#f08a6b` case-duplicates, and `#3FCB9B`
  vs palette `emerald #2CE5A7` — a *near-miss* accent that isn't the token).
- **60 inline `style={{}}`** objects.

### P2 — One accent in name, four in practice
The palette defines emerald as the money/success accent, but cyan, violet,
and amber all act as accents on real pages. The benchmark principle the
founder's research converged on (Stripe/Linear/Raycast: one accent doing all
the work) is defined here and not yet enforced anywhere — no ratchet, no
lint, no count.

### P3 — Locale coverage is honest-ledger-violating in UI
Message keys: **he 5,630 / en 5,615** (complete) vs **ar 703, ru 703 (12%),
de 436, fr 436 (8%)**. Four advertised locales fall back to English for ~90%
of strings. Either finish them, stage them behind "beta" labels, or remove
them from the switcher — advertising six languages and delivering two is a
trust bug, which for this brand is a design bug.

### P4 — Three font families = two too many voices
Heebo (correct Hebrew-first choice) + Suez One + Manrope. Manrope serves
Latin-ish UI moments Heebo already covers; Suez One is the display face.
Consolidation decision needed in D1: Heebo everywhere + Suez One strictly
for the one "star number" per screen, drop Manrope (or justify it in
DESIGN-SYSTEM.md). Premium path (Ploni, ~$845) is a **founder purchase
decision** — the token architecture makes it a later one-line swap.

### P5 — Not measured / not present (honest list)
- **Lighthouse / CWV lab scores: NOT measured** — no Lighthouse in this
  environment. Needs a CI job (Lighthouse CI) or a founder-side run.
  Field data (CrUX) needs real traffic through Vercel Analytics.
- **Sentry: not integrated** — needs a founder DSN (env), then the
  `@sentry/nextjs` wiring is mechanical (D4).
- **External uptime monitor: none** — founder account on UptimeRobot/Better
  Stack pointing at `/api/health` (D4; can't be done from inside the repo).
- **Visual regression: none** — Playwright is used for sweeps but no
  `toHaveScreenshot()` baselines (D4).
- **Duplicate-component pass: partial** — known near-duplicate trio
  (`ParkingAppeal`/`TransportFineAppeal`/`WarrantyAppeal`, ~150–230 lines
  each + parallel API routes) already identified in the leveling-up plan as
  a generalization target. A full 183-component duplication scan is a
  dedicated D3 step, not done today.
- **Dead translation keys / unused exports: not scanned today** — `knip`
  or `ts-prune` run belongs to D3; the orphan ratchets already cover whole
  modules/pages.

### P6 — Microstates & states are unaudited
The six-microstate rule (default/hover/focus/active/disabled/loading) and
designed empty/loading/error states exist in many components (the a11y sweep
proves focusability and contrast) but nothing *enforces* them. No count today
— enforcement mechanism (a states section per component in a dev styleguide
route) is D1 work.

## 4. Top problems, prioritized (the "top 20" distilled to what matters)

1. 2,987 arbitrary values / 53 raw hex colors — finish the token migration
   the type scale started; add color + spacing ratchets like `typeScale`.
2. One-accent rule: decide it (emerald), tokenize the near-misses
   (`#3FCB9B` → `emerald`), ratchet new accent introductions.
3. Locale honesty: ar/ru/de/fr at 8–12% — stage, finish, or remove.
4. Font voices: 3 → 2 (Heebo + Suez One), Manrope decision.
5. text-size migration: 1,418 → 0, screen by screen, ratchet lowered on
   every PR (mechanism already exists).
6. Dev-only `/styleguide` route: tokens, type, microstates, RTL/LTR —
   the review gate D1 needs.
7. Case-duplicate hexes and near-miss accents (`#3fcb9b` vs `#3FCB9B` vs
   `emerald`) — mechanical cleanup, high polish-per-effort.
8. Inline styles: 60 → justified-only.
9. Lighthouse CI + budgets in the pipeline (the only unmeasured hard gate).
10. Sentry + external uptime (founder env/account + mechanical wiring).
11. Playwright visual-regression baselines for the 7 core pages.
12. Intake-component generalization (the known trio) — D3's first refactor.
13. Physical-direction classes: 4 → 0 (trivial; add lint rule to keep at 0).
14. Microstate enforcement via styleguide review checklist.
15. Middleware 421 kB — investigate what rides in it (i18n tables?).

## 5. Proposed page redesign order (D2)

Per the master prompt's order, adjusted for what the loop needs first:
1. `/he` home (benchmark: Stripe hero calm + Mercury transparency)
2. `/he/money` (the product core — Mercury density + tabular figures)
3. `/he/how-it-works`
4. `/he/pricing` (the 18% success fee — `FEE_RATE_BPS = 1800`, verified in
   `src/lib/fee.ts` — shown with zero ambiguity)
5. `/he/business`
6. `/he/agents` + Mandate surfaces (Vercel/Linear technical credibility)
7. `/he/status`, `/he/changelog`, network-proof pages

## 6. Conflicts with the D-track prompt to resolve before D1 (founder decisions)

1. **Light mode**: the prompt assumes light+dark token sets; the shipped
   design is deliberately dark-only. Building light mode is a product
   decision, not a default — recommend staying dark-only through D2 and
   deciding after the core pages are polished.
2. **Font purchase**: Ploni license (~$845) — founder budget decision;
   free baseline (already Heebo) is correct until then.
3. **Sentry DSN + uptime account**: founder-created credentials; code
   wiring is ready to go the day they exist.
4. **Locale strategy** (P3): finish vs stage vs remove is a product call.

---

*Next step per the working agreement: this audit is the D0 deliverable.
D1 (tokens + styleguide route) starts only after the founder reviews this
file — the highest-leverage review gate in the whole track.*
