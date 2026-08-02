# Contributing a country pack

`src/lib/global/` is built so that adding a jurisdiction is adding a data file,
never an engine change. This document is that process, written down — it did
not exist before, which meant the only people who could plausibly add a
country were engineers on this team who already knew the codebase. That is
the opposite of what the architecture is for.

## Why this is safe to open up

A pack cannot execute anything. It is a list of `RightDef` values — a
predicate, a statutory citation, and a letter template — evaluated by a
generic interpreter (`evaluatePack`, `renderDocument` in `engine.ts`) that
already exists and does not change. Nothing a contributed pack contains can
reach a network, move money, or run arbitrary code: `validatePack()` rejects
any action containing an external URL, and the `PackAction` schema has no
"initiate a payment" kind to begin with. Reviewing a pack is reviewing data
and a citation, not auditing new code paths.

## Before you write anything

1. Read `src/lib/global/types.ts` in full — the type definitions are
   commented as the specification, not just as code.
Zakai ships **13** jurisdiction packs (IL, GB, US, DE, FR, CA, AU, IE, NL, ES, IT, SE, PL) — see `src/lib/global/registry.ts`.
3. Every right you add needs a real citation — the actual statute,
   regulation, or directive, in enough detail that someone else could look it
   up. "It's common knowledge" is not a citation. If you cannot cite it,
   leave it out; a shorter, correct pack is more valuable than a longer one
   with a guess in it.
4. No amount you cannot defend. `yearlyMinor`/`oneTimeMinor` are optional for
   exactly this reason — a right whose value depends on individual
   circumstances is still worth listing, without one.

## The shape of a pack

```ts
export const XX_PACK: JurisdictionPack = {
  market: "XX",        // ISO 3166-1 alpha-2
  version: "1",
  reviewed: "2026-07-30",   // the date you checked this against the law
  docLocale: "xx",     // BCP-47 — the language official correspondence must use
  currency: "XXX",     // ISO 4217
  minorUnits: 100,     // 100 for most currencies, 1 for JPY-style currencies
  recipients: {
    tax_office: "Tax Office\n{municipality}",
  },
  rights: [
    {
      id: "xx_child_benefit",         // prefix with the market code
      category: "family",             // from the shared RightCategory list
      when: all(parent, working),     // a predicate built from the helpers below
      yearlyMinor: 120_000,           // omit if the amount genuinely varies
      source: "Real statute name, article N",
      action: {
        kind: "letter",
        recipient: "tax_office",
        fields: ["period"],
        subject: "Subject line, in docLocale",
        body: "Body, in docLocale, with {placeholders} for collected fields.",
      },
    },
  ],
};
```

Predicates are built from the small constructor set in `types.ts`
(`all`, `any`, `not`, `num`, `is`, `oneOf`, `extraIs`) against the shared
`UniversalProfile` shape — age in years, employment, dependents, housing,
income band, disability, partnership, migrant years, military status, plus a
namespaced `extra` bag for anything only your market's rules need. Do not
grow the shared profile for a market-specific question; put it in `extra`.

## Registering it

Add one line to `MARKETS` in `registry.ts`:

```ts
XX: { code: "XX", pack: XX_PACK, uiLocales: ["xx", "en"], label: "Your Country" },
```

## Validating it

There is no separate tool to install. The existing test suite is the
validator, and it picks up every registered market automatically:

```
npx vitest run src/lib/global/engine.test.ts
```

`"accepts every shipped pack"` runs `validatePack()` (duplicate ids, missing
citations, external links, malformed recipients, non-ISO market codes) against
every market in the registry, including yours the moment you register it.
Fix everything it reports before opening a pull request — a pack that fails
its own validator is not ready for anyone to rely on.

## What this does not do yet

UI display copy (a plain-language title and explanation for each right, in
the app's interface languages) is a separate step, tracked apart from the
pack itself — a pack with real citations and letters is useful before that
copy exists, since `GlobalPackRights.tsx` falls back to showing the right's
own `source` as its label rather than blocking on translation. Contributing
that display copy for an existing pack is exactly as welcome as contributing
a new one.
