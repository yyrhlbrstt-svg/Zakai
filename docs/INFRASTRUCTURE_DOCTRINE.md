# Zakai — Infrastructure Doctrine (Cursor operating system)

You are working on Zakai, the consumer money operating system.

**Highest goal:** not “another consumer app” — become the unavoidable infrastructure layer that every bank, telecom, utility, insurer, municipality, and competing AI agent must eventually speak to.

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

5. **Expand country packs only after the Israeli loop is unbeatable.**  
   GB, US, DE, FR, CA skeletons exist. Fill them only when the Israeli engine can be dropped into a new market with minimal rewrite.

## Hard rules for every change

- Never break the no-callback doctrine.
- Never invent savings amounts. Only real, user-recorded, documented outcomes become SavingsProof.
- Never drift into “advice” or “call center.” Everything stays self-serve + written + Mandate-backed.
- Prefer depth in the core loop over new verticals or shiny features.
- Every new screen or API must answer: **“Does this create more Mandates or more SavingsProofs?”** If no — deprioritize.

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
