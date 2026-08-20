# Collection doctrine — closing the leakage gap

**The problem, named:** success-fee models leak at collection. The win is
created, the money lands with the customer, and the fee becomes a request.
This gap explains the whole market's shape (payment-routing at AirHelp,
card-first at Rocket, the general flight to subscriptions). Zakai's answer is
not one trick — it is a collection mechanism matched to each path the money
actually travels.

## The three routes

### Route A — institution pays money out (refunds, deposits, compensation)
Become the money's address instead of chasing it: the Mandate carries an
assignment-of-rights clause and the demand letter directs payment to a trust
account; Zakai deducts the fee and forwards the rest same-day. End-state
evolution: purchasing the claim outright (stage 3 of the ladder), where 100%
flows to the purchaser by law.

**Status: blocked on counsel + credentials, deliberately.**
- The assignment clause is REAL legal drafting under חוק המחאת חיובים,
  התשכ"ט-1969 — with exceptions (obligations whose terms restrict assignment,
  consumer-protection constraints on the clause itself). It enters letters
  only after a lawyer drafts and signs off on the text. No engineer writes it,
  including the AI ones. (Non-negotiable #1: never fabricate legal claims.)
- The trust account is a partner-lawyer structure the founder sets up.
- Claim purchase (stage 3) is a licensed financial activity — a licensed
  funding partner, not a feature flag.

What code does meanwhile: the ledger already records `claimBasisMinor` /
`escalationStage` / `rightId` on every settle, so the actuarial base this
route will need is accumulating from day one.

### Route B — savings appear as a discount on future bills (telecom, bank)
Nothing to intercept — the money never moves. So the payment method is
captured at Mandate signing, not after the win: a tokenized card / debit
authorization charged automatically only when a verified SavingsProof exists,
inside the existing 14-day dispute window. No payment method → no
success-fee representation (subscription instead). Residual non-collection
is priced into the model the way acquirers price chargebacks — never
"solved" to zero.

**Status: the rails exist, the switch stays off.**
- `src/lib/payments/` (PayPlus adapter + mock), `Fee` accrual from
  SavingsProof, and the dispute window already exist; collection remains OFF
  behind the flag until PSP credentials are configured AND the pre-auth flow
  passes legal review (master plan §6.4). Turning it on is a founder
  decision, not a deploy.

### Route C — state pays the citizen directly (tax, funds)
No interception possible or desirable: the refund goes only to the citizen's
own bank account. Operate like the tax-refund industry: pre-signed debit
authorization + amount known in advance. Solved pattern; adopt, don't invent.

## The strategic consequence

The collection problem is WHY the hybrid model is right, not a bug in it:
success fee where the money can flow through the rail (A), subscription and
B2B2C where it cannot (B), full assignment as the next evolutionary stage.
And the fourth moat: whoever holds the trust account and the inbound payment
pipe is not a service provider — it is a clearinghouse.

## Owner actions (nothing in code substitutes for these)
1. Counsel: assignment-clause drafting + trust-account structure (Route A).
2. PayPlus production credentials + legal review of pre-auth-at-signing
   (Route B).
3. Decision to flip collection ON — explicitly, never implicitly.
