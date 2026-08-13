# The ceiling, and the four things that break it

There are already thirty strategy documents in this folder and thirty modules
under `src/lib/monopoly/`. This is not a thirty-first idea. It is the ordering
document: what the ceiling is, what breaks it, and in what sequence — written
because the honest answer to "why aren't we further along" turned out to be a
sequencing error, not a missing feature.

## The ceiling is real and it is arithmetic

The current unit of value is: one person recovers money from one company, once,
and we take 18% of a documented saving.

That business is bounded by `adults × recoveries per year × average recovery ×
take rate`. In one country those four numbers multiply out to a good company
and a hard ceiling. No amount of execution on that unit changes its shape,
which is why the founder is right that there is a ceiling, and why more
verticals — the instinct that produced 91 tools — moves the numbers a little
and the shape not at all.

## What we got backwards

Two independent strategy reviews reached this repository recommending the same
thing: abandon the interface, build the protocol, become the infrastructure.

We have already done that, and it is why nothing has happened. There is a
signed Mandate format, a public JWKS, revocation status lists, conformance
vectors, an inbound receiver, a delegated-issuer registry, thirteen market
packs — and zero institutions, zero traffic, zero verifications.

**A protocol with no traffic is not infrastructure. It is a specification in a
repository.**

Every standard that won was won on the receiving side, and the receiving side
only ever standardises when volume makes the manual path expensive. Stripe did
not win by publishing an API; payments already had to flow. TLS won because
browsers shipped it with the traffic. MCP won because it arrived carrying use.

So the sequence is the opposite of what those reviews said:

> volume → cost pain at the institution → we remove that cost for free →
> they wire it → they prefer our format → they tell their own customers to
> use it → we are the layer.

Not: layer → volume. That direction has never worked anywhere, and it is the
direction this repository has been building in.

The practical consequence is worth stating plainly, because it inverts how the
consumer product is valued internally: **every hour spent making the consumer
loop finish is protocol strategy.** It is not the small business funding the
big one. It is the only thing that generates the traffic that decides whose
format the receiving side is forced to adopt.

## The one thing we own that is genuinely scarce

Any agent can write any letter. That is already commoditised and will be free.

What no agent can do is **prove a human authorised it, in a form the receiver
can verify without trusting the agent's vendor.** That is the bottleneck of the
agent economy, it is a trust-root problem rather than a model problem, and
trust roots are decided by whoever the *verifying* side settles on.

Which means the strategic asset is not that we issue Mandates. It is that we
can make a Zakai request cost an institution nothing, unilaterally, for free,
while every other request costs them a person's time. Issuance should be
federated — `DelegatedIssuer` already exists for exactly this. Verification
should be monopolised. Visa does not issue cards.

## The four multipliers, ranked by ceiling

**1. Mass events — the only counter-cyclical asset.**
One regulatory refund, one certified class action, one insolvency: hundreds of
thousands of people, one eligibility rule, near-zero marginal cost per claim.
This is not twice the business, it is a different volume regime, and it grows
when the economy hurts. Built in `src/lib/signal/`.

The founder's framing was "a bank collapsed, make money from it". The version
that is legal, larger, and puts us on the right side of it: **be the fastest
path to money people are already owed when something breaks.** Roughly nineteen
in twenty never claim. Trading on the collapse itself requires a licence we do
not have, is a different company entirely, and contradicts `FORBIDDEN_SCOPES`
in our own doctrine. It is not on this list and it will not be.

**2. Actions beyond recovery.**
Cancel, switch, dispute, subject-access, consent-revoke. Same Mandate, same
rails, vastly larger surface than "money back" — and the revenue is not a
percentage of a consumer's saving, so it is not bounded by the arithmetic at
the top of this document.

**3. Agent authorisation as a public product.**
Every AI agent that needs to act on a person's money needs a scoped, signed,
revocable, publicly verifiable authority. We charge per verified authorisation.
This scales with the agent economy rather than with our own user count, which
makes it the only line here that is structurally uncapped. The core shipped
already: `src/lib/agentAuth/`, the consent screen, the token exchange.

**4. The measurement franchise.**
`StrategyOutcome` accumulates which counterparty settled, how fast, at what
discount, against which argument. Nobody else can compute that — not banks,
who see only themselves; not regulators, who see only what escalates; not
consumers. Three audiences: consumers get better letters, institutions get a
benchmark, and regulators and press get a citable measure. The third is what
makes the second pay.

## Why it cannot be copied by cloning a feature

Four locks, each of which strengthens the others:

1. **Accumulated casework** — bought with time, not code.
2. **Trust-root position** — the switching cost sits with the institution.
3. **Event inventory** — a permanent, cited library; claim windows outlive
   news cycles.
4. **Regulatory citation** — once a measure is cited, it becomes a reference,
   and references are sticky.

Volume feeds data, data feeds measurement, measurement earns citation,
citation forces institutional engagement, engagement adopts the format, the
format returns volume. Every loop starts at consumer volume, which is
currently zero.

## The honest bottleneck order

1. **Nothing is deployed.** Production runs `main`; the work is on a branch.
   This blocks everything below it and is not an engineering decision.
2. **Zero users.** The flywheel has no first turn.
3. **No event inventory.** The engine stands; nothing is in it.
4. **No institution has ever verified a Mandate.** Until one does, the layer
   is a claim.

## Build order

- **0.** Deploy. Nothing else counts until the fixes are live.
- **1.** Event engine end to end — sourced events, matching against real user
  facts, and the screen that says "this happened, here is your part of it".
  This is the only mechanism that gives somebody a reason to open the app
  without being sold to.
- **2.** Standing authorisation — one approval, many actions. This is what
  turns a one-time tool into a system somebody stays inside.
- **3.** Outcome-graph exploitation — the letter we send is the letter that
  empirically worked on that company last month.
- **4.** Institution zero-cost intake — the wedge.
- **5.** Agent authorisation as a public, documented product — the layer.

## What is deliberately not here

No revenue forecast, no valuation, no market-size figure. Two strategy reviews
arrived carrying confident percentages for agent adoption, pilot failure rates
and machine-identity ratios, none of which can be verified from here. A plan
built on numbers nobody checked is the same failure as a claim of entitlement
without a citation — and this company's only real asset is that when it states
something, the statement holds.
