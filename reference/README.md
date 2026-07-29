# Reference implementations

A specification written by one party and implemented only by that same party is
not a standard — it is an API with documentation. The question a prospective
adopter actually has is whether somebody who is *not* us can implement this
correctly from the published material.

Here it has been implemented five times, in five languages, by five independent
programs that agree on all nineteen vectors.

```
$ ./check-all.sh
  python   CONFORMANT — 19/19 vectors passed.
  go       CONFORMANT — 19/19 vectors passed.
  java     CONFORMANT - 19/19 vectors passed.
  ruby     CONFORMANT - 19/19 vectors passed.
  php      CONFORMANT - 19/19 vectors passed.

  5 implementations, all conformant.
```

## Every one has zero dependencies

| Language | File | Runs with |
|---|---|---|
| Python | `python/zakai_decide.py` | `python3` |
| Go | `go/zakai_decide.go` | `go run`, no modules |
| Java | `java/ZakaiDecide.java` | `java ZakaiDecide.java`, no Maven |
| Ruby | `ruby/zakai_decide.rb` | `ruby`, stdlib only |
| PHP | `php/zakai_decide.php` | `php`, no Composer |

That is not a stylistic flourish. The decision layer performs no cryptography —
signature verification happened earlier, in whatever JWT library the
institution already runs, and by the time a claim set arrives its authenticity
is settled. What remains is policy, and policy is comparisons on a map.

Which means "paste this file" instead of "add a dependency". At a bank those are
different conversations: one takes ten minutes, the other is a supply-chain
review that does not happen this quarter. A standard nobody can evaluate quickly
is a standard nobody adopts.

Language choice follows who the counterparties are. Go and Java because payment
and core banking run on them. PHP because a great deal of utility, telco and
municipal billing software does, and those are the counterparties least likely
to accept a new package to evaluate an idea.

## What writing them found

Three things, which is the entire argument for doing it.

**Invented vocabulary.** The first Python draft used scope names that do not
exist (`subscription:cancel`, `refund:request`) and missed four that do. Anyone
implementing from a mental model rather than the published table would make the
same mistake and ship it.

**A conflated distinction.** That draft also assumed a scope's risk tier and its
need for per-act confirmation were the same question. They are not:
`request:records` is correspondence-tier and still standing, because asking
somebody to confirm every individual request for their own records is friction
with no safety behind it. That distinction lived only in the TypeScript source
until an independent implementation got it wrong — which is exactly when a
specification is supposed to discover it was ambiguous. It now has a vector.

**A bug in the original.** Writing the vectors caught the TypeScript
implementation failing one of its own: it checked expiry before the
forbidden-scope rule, so an expired token bearing `payment:initiate` came back
as `expired`. That hides a registry-level incident — somebody is issuing
forbidden mandates — behind a routine stale credential. The categorical limit
now precedes every temporal check in all five implementations, and a vector
pins the ordering so it cannot drift back.

## The vectors are the contract

Deterministic — fixed key, fixed timestamps, fixed identifiers — so the same
inputs produce the same answers in every language, forever. They cover every
deny reason plus the orderings where two rules could both fire.

The ordering vectors are worth the most. Every implementation gets the simple
cases right; what diverges is which reason comes back when a token is both
expired and misaddressed, and an integrator branching on `reason` depends on
that being identical everywhere.

There is no partial credit. One wrong answer in a trust network is one
participant honouring something nobody else does, which is worse than either
behaviour on its own.

The runner was also checked for being vacuous rather than assumed sound:
removing the forbidden-scope rule fails three vectors, removing the per-act
rule fails one.

## Porting to a sixth language

Read whichever file is closest to your stack; they are all short and the check
ordering is normative. Then run the vectors. If they pass, your implementation
agrees with every other one on every case anybody has thought to disagree about.

Send it and it goes in this directory.
