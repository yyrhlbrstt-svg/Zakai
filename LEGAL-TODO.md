# LEGAL-TODO — the human gates

Generated per Master Build Prompt v2, Phase 0. Items LT-1..LT-4 are wired
into code: `src/lib/legalGates.ts` hard-fails any feature that ships behind
them unless the item below is marked complete (`- [x]`) AND the matching
attestation env var is set. Marking an item complete is a statement of fact
about work done outside this repository — only a human does it, never an
agent (Master Prompt §10: "Never enable a dark flag yourself").

## Gated items (each blocks a dark flag)

- [ ] LT-1 **Fee collection (Route B)** — PayPlus/Stripe production
      credentials configured; consumer-law review of the
      payment-method-at-Mandate-signing flow (pre-authorized charge on
      verified SavingsProof, 14-day dispute window) completed in writing.
      Gate: `fee_collection` · attestation env: `LEGAL_ATTEST_FEE_COLLECTION=LT-1`
- [ ] LT-2 **Assignment-of-rights clause (Route A)** — clause drafted and
      signed off by counsel under חוק המחאת חיובים, התשכ"ט-1969, including
      the exceptions analysis (obligations restricting assignment;
      consumer-protection constraints on the clause itself). The clause text
      enters letters only from counsel's signed version.
      Gate: `assignment_of_rights` · attestation env: `LEGAL_ATTEST_ASSIGNMENT=LT-2`
- [ ] LT-3 **Trust remittance (Route A)** — partner-lawyer trust account
      established; written reconciliation procedure (expected →
      received_in_trust → fee_deducted → paid_out_to_client); confirmation
      that Zakai holds no client money at any point.
      Gate: `trust_remittance` · attestation env: `LEGAL_ATTEST_TRUST=LT-3`
- [ ] LT-4 **Claim purchase (stage 3)** — licensing analysis for purchasing
      consumer claims (רישוי שירותים פיננסיים) and/or executed agreement
      with a licensed funding partner.
      Gate: `claim_purchase` · attestation env: `LEGAL_ATTEST_CLAIM_PURCHASE=LT-4`

## Ungated but required (Phase 0 list)

- [ ] LT-5 Agency/UPL opinion — written counsel opinion that the
      client-as-sender agency model (שליחוּת) as implemented does not
      constitute unauthorized practice of law; includes review of the
      forbidden-phrases lint list.
- [ ] LT-6 Licensing threshold map — at what volumes/activities payment,
      credit-provider, or financial-data licenses are triggered, and which
      partner bridges cover the interim.
- [ ] LT-7 Professional liability / cyber insurance.
- [ ] LT-8 External penetration test of the production deployment.

## Status log

- 2026-08-20 — file created (Phase 0 v2). No item complete yet; all four
  gates dark, verified by `legalGates.test.ts`.
