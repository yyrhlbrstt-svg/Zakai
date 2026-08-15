# The plan for today

Written to be executed, not admired. Everything in the "today" section is
finishable today by the person named next to it.

---

## 1. What the goal actually requires

The stated goal is that everyone has to go through Zakai. That is a claim about
a *mechanism*, and there is exactly one mechanism in this building with that
shape.

Any AI agent that wants to act for a person needs authority an institution will
honour. Right now it has two options: ask the person for their bank password,
or have nothing. Neither scales and the first one ends in a regulator's office.

Zakai already holds the hard half of the third option — Ed25519 signing, a
public JWKS, a closed scope set that can never move money outward, status-list
revocation any institution can poll, audience binding, a reference verifier,
conformance vectors. If agent developers adopt this before an alternative
exists, permission is a thing that happens here.

Nothing about that requires anyone to like us. It requires being the only place
the permission is safe to grant, and being there first.

## 2. What is true right now, measured

| | |
|---|---|
| Consumer loop | **Cannot complete.** No SMTP → no verified owner → nothing reaches SENT → no SavingsProof and no Fee can exist |
| Authority protocol | Complete and working, and **reachable by nobody** — registration is a manual database insert |
| Revenue | Zero, on all three lines, each disconnected at the wiring |
| App quality | 136 routes, 0 unreachable controls signed out and signed in, 0 WCAG AA violations, 2,678 tests, 5/5 browser loop checks |
| Dependencies | 4 known vulnerabilities left, all needing a major upgrade |

The last row is why "just fix the app" is not the plan. The app is not what is
broken.

## 3. Today

### Founder — one thing, ten minutes

**Turn on SMTP.** `docs/TURN_ON_MAIL.md`. No domain needed, no company, no
signature — a Gmail App Password. Then `npm run mail:check`.

This is not one item among several. Until it is done, every consumer number in
this product is structurally zero, and no amount of engineering changes that.

### Engineering — give the authority door a handle on the outside

1. **Self-serve agent registration.** Today an `AgentClient` row is inserted by
   hand. A door that only opens from the inside is not a door. A developer must
   be able to register, get a slug, and start the handshake without speaking to
   anyone.

2. **A discovery document a stranger can find.** `/.well-known/` already serves
   nineteen protocol documents and none of them describe how to ask a person
   for authority, because until yesterday there was no way to.

3. **A mechanical proof of the integration claim.** A script that, from a clean
   checkout, registers an agent, runs the whole handshake and verifies the
   mandate against the public JWKS. Not a sentence in a README asserting it
   takes thirty minutes — a job that fails if it does not.

## 4. After today, in order, and not before

**Next: the first outside agent.** One. A hobbyist's assistant is enough. Until
one exists the protocol is a specification with good tests, and the difference
between a specification and a network is the first user, not the tenth.

**Then: the first institution that honours a mandate.** `reference/
inbound-receiver/` exists so this costs them an afternoon. The doctrine forbids
cold outreach and it is right to — an institution that adopts because it was
sold will drop it the moment the salesperson leaves.

**Then, and only then: charging.** The app's own priority list scores payments
99 out of 99 with `blocksMonopoly: false`. Checkout without volume is SaaS. The
subscription line is built and dormant; it stays dormant until the founder says
otherwise.

## 5. How we would know we are wrong

Written down now, while it costs nothing to be honest about.

- **Six months, zero external agents registered.** Then agent developers do not
  feel the permission problem yet, and we are early in the way that is
  indistinguishable from wrong.
- **An institution refuses a valid mandate.** Then the authority is not worth
  holding, and every layer above it is decoration.
- **The consumer loop closes and nobody finishes it.** Then the problem was
  never the plumbing.

None of these have been tested, because the first one cannot be tested until
registration is self-serve and the third cannot be tested until mail is on.
That is what today is for.

## 6. What this plan deliberately does not say

It does not put a number on the outcome. Not because the ambition is wrong —
the mechanism is real and the position is genuinely defensible — but because a
number from an engineer who has not yet shipped a single external integration
is a guess wearing a suit, and this company has a rule against that in
`CLAUDE.md`, non-negotiable number one.

What can be said without inventing anything: this is the only asset here that
gets *harder* to replace as it grows, and today is the first day it is possible
for anyone outside this building to use it.
