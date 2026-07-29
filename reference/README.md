# Reference implementations

A specification written by one party and implemented only by that same party is
not a standard — it is an API with documentation. The question a prospective
adopter actually has is whether somebody who is *not* us can implement this
correctly from the published material, and the only convincing answer is a
second implementation that passes the same vectors.

## `python/zakai_decide.py`

The decision layer, in Python, with **zero dependencies** — no `pip install`,
no virtualenv, no supply chain to review. It performs no cryptography, because
by the time a claim set reaches this code its authenticity was already settled
by whatever JWT library the institution already runs. What remains is policy,
and policy is comparisons on a dict.

That is not a stylistic choice. "Add a dependency" is a procurement
conversation at a bank; "paste this file" is not. Anything that turns a
ten-minute evaluation into a security review will not happen this quarter, and
a standard nobody evaluates is a standard nobody adopts.

```bash
# Against a live deployment
python3 python/zakai_decide.py --url https://zakai-3uxj.vercel.app

# Against a local copy, for CI with no outbound network
python3 python/zakai_decide.py --file vectors.json
```

Exit code is `0` when every vector passes and `1` otherwise, so it drops
straight into a pipeline. There is no partial credit: one wrong answer in a
trust network is one participant honouring something nobody else does.

## What writing it found

Two things, immediately, which is the entire argument for doing it.

The first draft invented scope names that do not exist (`subscription:cancel`,
`refund:request`) and missed four that do. Anybody implementing from a mental
model rather than the published table would have made the same mistake, and
would have shipped it.

The second is subtler and now has a vector of its own. The draft assumed a
scope's risk tier and its need for per-act confirmation were the same question.
They are not: `request:records` is correspondence-tier and still standing,
because asking somebody to confirm every individual request for their own
records is friction with no safety behind it. That distinction existed only in
the TypeScript source until an independent implementation got it wrong, which
is exactly when a specification is supposed to find out that it was ambiguous.

## The vectors are the contract

Deterministic — fixed key, fixed timestamps, fixed identifiers — so the same
inputs produce the same answers in every language, forever. They cover every
deny reason plus the orderings where two rules could both fire.

The ordering vectors are the ones worth the most. Every implementation gets the
simple cases right; what diverges is which reason comes back when a token is
both expired and misaddressed, and an integrator branching on `reason` depends
on that being the same everywhere. Our own TypeScript implementation failed one
of these when the vectors were first written — it reported `expired` for a
token that also carried a forbidden scope, hiding a registry-level incident
behind a routine stale credential.

## Porting to another language

Read `zakai_decide.py`; it is deliberately short and the check ordering is
normative. Then run the vectors. If they pass, your implementation agrees with
every other one on every case anybody has thought to disagree about.
