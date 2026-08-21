# Zakai — Infrastructure Doctrine (Cursor operating system)

You are working on Zakai, the consumer money operating system.

**Highest goal:** not “another consumer app” — become the unavoidable infrastructure layer that every bank, telecom, utility, insurer, municipality, and competing AI agent must eventually speak to.

## Asymmetric win (why we can beat “all companies combined”)

We do **not** win by outspending banks on ads or out-building Cellcom’s app.

We win the way Visa won: become the **pipe** every other actor must speak.

| Player | What they have | What they lack |
|--------|----------------|----------------|
| Banks / telecoms | Customers, balance sheets | Machine-verifiable consumer-agent authority; hate phone POA chaos |
| Consumer apps / “AI advisors” | Chat UI, letter drafts | Signed Mandate + append-only SavingsProof + fee-on-proof |
| General AI agents | Intelligence | A format institutions will accept at scale without callbacks |

Zakai’s stack is the missing pipe: **Mandate (inbound-only) → written act → SavingsProof**.  
Other companies become clients of the rails — or look outdated next to whoever already verifies.

**Operating implication:** every sprint either (a) shortens Israel zero→SENT Mandate, (b) raises Mandate/SavingsProof volume, or (c) makes foreign agents/institutions adopt the open format. Anything else is noise.

**Monopoly definition:** institutions and foreign agents **must** speak Mandate→SavingsProof because ignoring it is more expensive than verifying. That only happens at `gravity_tier=network` with real SMTP delivery — not slides. Execution board: `GET /api/network/monopoly` → `monopolyLoop.p0` · UI: `MonopolyMissionControl` on `/founder`, `/pipe`, `/domains`.

**Ship surface for the rails:** `docs/PIPE.md` · `/.well-known/zakai-pipe.json` · `/.well-known/zakai-agents.json` · `/he/pipe` · `POST /api/pipe/accept` (registry-backed) · `POST /api/pipe/handoff` (primary agent door).

## Core thesis

Zakai wins by becoming the **standard protocol** + the **only closed-loop system** that turns consumer intent into documented money outcomes.

The two things that create lock-in:

1. **Mandate** — Ed25519 JWS, inbound-only, verifiable, revocable, no callback.
2. **SavingsProof** — append-only, integer agorot, auditable record of real money that moved.

Everything else (UI, verticals, agent intelligence, country packs) exists only to force more Mandates to be issued and more SavingsProofs to be written.

## How Zakai becomes infrastructure institutions must connect to

### 1. Mandate becomes the de-facto authorization standard

- Keep the Mandate strictly **inbound-only**. Institutions never call us back. They only verify a signed JWS against our JWKS + status list.
- Make verification dead-simple: one public JWKS endpoint + clear OpenAPI + conformance probe.
- Publish the Mandate as an open, adoptable standard (not a proprietary black box). Other AIs and fintechs should be able to issue or verify the same format.
- Every successful case that produces a SavingsProof is living proof that the Mandate works in the real world. **Volume of real SavingsProofs is the only marketing that matters to institutions.**

### 2. Closed-loop superiority

- No other player in Israel (or most markets) has the full loop: screenshot → extract → Case → signed Mandate → written negotiation → follow-up → documented saving → fee only on success.
- Banks and providers hate phone calls and unlogged chats. A clean, verifiable written Mandate + clear ask is easier for them to process than chaos. We make their life better while extracting value for the consumer.

### 3. Data and outcome gravity

- Every SavingsProof is permanent evidence. Over time the platform accumulates the only high-quality, privacy-preserving dataset of what actually works against each provider and vertical.
- Institutions that refuse to speak Mandate look increasingly outdated next to those that do.
- Competing consumer apps that only generate letters without the Mandate + SavingsProof loop become second-class.

### 4. Network effects that force adoption

- **Consumers:** “I only use tools that can actually move money and prove it.”
- **Other AIs / agents:** “If I want to act on behalf of a user for money outcomes, the cleanest way is to issue or carry a Zakai-compatible Mandate.”
- **Banks / providers:** “The volume of legitimate, signed, auditable requests in this format is high enough that supporting verification is cheaper than ignoring it.”

## How we become strongest in Israel (then globally)

Priority order (**do not invert**):

1. **Perfect the Israeli closed loop first.**  
   Money Hub → every high-ROI vertical (telecom, bank fees, electricity, flights, deposit, late-payment, parking, transport fine, cancel) must go from zero to **SENT Mandate in under 3 minutes on mobile**. Zero friction.

2. **Make the agent outcome-obsessed.**  
   Never chat for chatting’s sake. Every answer ends with the single highest-ROI next screen. Multi-problem users ranked by expected recovery × speed × documentation quality.

3. **Drive Mandate volume and SavingsProof volume harder than any feature.**  
   Measure success by: Mandates issued, written rounds, SavingsProofs recorded, total agorot proven — **not** DAU or time-in-app.

4. **Turn the Mandate into an open standard others adopt.**  
   JWKS + status list + conformance suite rock solid. Document clearly. Never add a callback requirement. Inbound-only is a feature.

5. **Expand country packs as data — never `if (country)` soup.**  
   Shipped packs include IL + major markets + **EU** + **XX (international fallback)** so every geo can cancel, dispute fees, and generate letters. Deepen national packs with citations; unknown geos must never dead-end.

## Hard rules for every change

- Never break the no-callback doctrine.
- Never invent savings amounts. Only real, user-recorded, documented outcomes become SavingsProof.
- Never drift into “advice” or “call center.” Everything stays self-serve + written + Mandate-backed.
- Prefer depth in the core loop over new verticals or shiny features.
- Do **not** try to look impressive in many small ways. Be **decisive** in a few critical ways.
- Every new screen or API must pass the **decisive filter** below. If it fails — deprioritize.
- **Zakai speaks only when it is sure and there is somewhere to go.** See the silence law below.

### The silence law

`rightForLetter()` already refuses to let unverified law reach an institution. That
gate was pointed in one direction only, and the thing a person experiences first is
not a letter — it is a screen telling them they are being overcharged, which is an
assertion about their money that nobody asked for.

So the same gate points inward, as `decideClaim()` in `src/lib/claimGate.ts`. Zakai
makes a claim only when **both** hold:

1. **Confidence is high** — measured, not asserted. The bar (`CLAIM_SPEAK_THRESHOLD`)
   sits deliberately above the 0.6 used where a human then confirms the proposal,
   because nothing here has a human in the loop before it reaches the screen.
2. **There is an immediate way to act on it**, in-app, now.

Fail either and the answer is **silence, not a hedge**. "You may possibly be owed
something, we are not sure, and there is nothing you can do about it here" transfers
our uncertainty to somebody with less information and no way to resolve it, and it
costs the same trust as being wrong. The asymmetry is the whole argument: a missed
detection costs one claim; a wrong one costs every future claim with that person.

Two consequences worth stating, because both are easy to get backwards:

- **A mirror is not a claim.** Reading somebody's own statement back to them is not
  an assertion, and hiding a row because we are unsure is its own betrayal — the
  person who knows they pay for that gym and cannot find it has just learned the scan
  misses things. The list stays whole; what gets gated is what Zakai *says about* it:
  the pre-ticked box, the "best win", the call to action. See `src/lib/scanClaims.ts`.
- **The action path is part of confidence, not a UI nicety.** A finding with no next
  step never becomes a case, so it never produces an outcome, so nothing ever tells us
  whether we were right. Alerts with no action are unfalsifiable by construction, and
  unfalsifiable alerts are the ones that rot quietly.

### The number that catches it before a user does

Every claim that passes the gate is recorded as `claim.surfaced` on the event spine.
Against `claim.created` and `outcome.recorded`, that gives **alert-to-outcome**
(`src/lib/intel/alertToOutcome.ts`, shown on `/founder`):

    surfaced ──► case created ──► proved in money

Two ratios, kept apart because they fail in opposite directions. **Surfaced → case**
collapsing means people are not believing us, or the finding had no usable next step:
a product failure, visible in days. **Case → proved** collapsing means people believed
us and we were wrong: a detector failure, far more expensive, visible only weeks later
— which is precisely why it is watched rather than waited for. A healthy first ratio
beside a dying second one is the exact shape of *getting very good at convincing people
of things that are not true*, and no single number separates it.

Below `MIN_SAMPLE` the ratios are `null`, never zero and never a percentage. A ratio
over three events is noise wearing a percentage sign, and steering on noise is worse
than not steering.

### Decisive filter

At every product decision, ask:

1. Does this help more users **finish the loop**?
2. Does this create more **documented SavingsProofs**?
3. Does this make Zakai **harder to replace**?
4. Does this increase **real pressure on institutions** over time?

If the answer is no — do not ship it to look busy. Zakai wins as the **default system for getting money back**, not as a large collection of tools.

## What “strongest in the market” looks like

- Israeli consumers treat `/money` as the default place to start any bill / fee / refund / compensation problem.
- Providers recognize “Zakai Mandate” as a legitimate, low-friction channel and respond faster than to ordinary consumer email.
- Other consumer apps and AI agents issue or verify Zakai-compatible Mandates instead of inventing their own formats.
- The SavingsProof ledger becomes the trusted record of real consumer money recovered in Israel.

## What we refuse

- Promising human callbacks when there is no team.
- Charging before documented saving.
- Impersonating the customer.
- Fake traction numbers / fabricated SavingsProofs.
- Cold institutional outreach as the primary growth path (pull via Mandate volume + desk pain).

## Near-term product law (shipping filter)

Every feature must either:

- **Find** money (detect leak),
- **Act** (letter / negotiation / filing path with Mandate path),
- **Prove** (SavingsProof ledger),
- or **Spread** (share / referral that drives more Mandates).

If it does none of these, it does not ship.

And even among Find/Act/Prove/Spread: ship only what is **decisive** for loop completion, documented proofs, switching cost, or institutional pressure — not incremental tool-shelf polish.

## Solo ops checklist

- [ ] AI keys live (assistant + OCR)
- [ ] PayPlus / payout for success fees
- [ ] Mandate keys + revocation table
- [ ] Dashboard next-step on every case status
- [ ] Share card after SAVED
- [ ] No lead form that lies about callbacks
- [ ] High-ROI IL verticals: zero → SENT Mandate &lt; 3 min on mobile

---

You are not building a nice app.  
You are building the rails that consumer money will run on.

Every line of code, every prompt, every vertical, every API should increase the gravitational pull of the **Mandate + SavingsProof** system.

If a change does not make the loop tighter, the Mandate more useful, or the volume of proven outcomes higher — question whether it belongs in the product at all.
