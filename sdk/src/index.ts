/**
 * @zakai/mandate-sdk — the reference client for the Zakai Mandate protocol.
 *
 * Three things, in the order you probably need them:
 *   1. Verify a mandate someone presented to you: `verifyMandateFromUrl`.
 *   2. Decide whether a specific act is authorised right now: `decide`.
 *   3. If you want a durable, disputable record of that decision: build one
 *      with `buildMandateRef` + `draftDecisionRecord`, sign it yourself, and
 *      later `adjudicate` the resulting chain.
 *
 * Every function here is ported from the production app it protects, not
 * reimplemented against a spec — the same code, so this SDK and Zakai's own
 * servers cannot silently disagree about what a mandate means.
 */

export * from "./scopes.js";
export * from "./domains.js";
export * from "./mandate.js";
export * from "./decision.js";
export * from "./settlement.js";
export * from "./conformance.js";
