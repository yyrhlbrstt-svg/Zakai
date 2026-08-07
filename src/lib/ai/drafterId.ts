/**
 * Which model actually wrote this, recorded so the question can be answered.
 *
 * WHY THIS EXISTS
 *
 * The outcome graph records `variantId` — the negotiation stance a letter
 * used — and learns which stance gets paid. It records nothing about which
 * model produced the text. So "does the stronger drafting model actually win
 * more often than the cheap one, or are we paying for a difference that isn't
 * there?" is not a hard question here; it is an unanswerable one, because the
 * fact was never stored.
 *
 * That matters more as models change underneath the product. Swapping the
 * drafting model is a one-line env change (`ANTHROPIC_MODEL`), and today that
 * change is unmeasurable: nothing before and after the swap is comparable.
 *
 * RECORDING THE TRUTH, NOT THE CONFIGURATION
 *
 * `generateText` falls back to a secondary provider when the primary fails at
 * call time — an expired key, no credits, an outage. So the configured model
 * and the model that actually ran are different things, and they differ
 * exactly when something is wrong, which is when the data matters most.
 *
 * This id is therefore only ever built from what a completed call reports.
 * There is deliberately no helper that derives it from env, because such a
 * helper would be indistinguishable at the call site from the honest one and
 * would quietly attribute Gemini's work to Claude.
 *
 * DE-IDENTIFICATION
 *
 * A drafter id names our own infrastructure — a provider and a model version.
 * It says nothing about a person, which is what keeps `StrategyOutcome`
 * publishable under the no-User/Case-FK rule.
 */

/** Providers the app can actually call. Mirrors `AiProvider` in ai.ts. */
export const DRAFTER_PROVIDERS = ["anthropic", "openai", "gemini", "ollama"] as const;
export type DrafterProvider = (typeof DRAFTER_PROVIDERS)[number];

/** Recorded when a draft predates model attribution, or the call reported nothing. */
export const UNKNOWN_DRAFTER = "unknown";

/** Upper bound on a stored id, so a malformed model name cannot bloat rows. */
export const MAX_DRAFTER_ID_LENGTH = 80;

export function isDrafterProvider(v: unknown): v is DrafterProvider {
  return typeof v === "string" && (DRAFTER_PROVIDERS as readonly string[]).includes(v);
}

/**
 * Build the stored id from what a completed call reported.
 *
 * Returns `UNKNOWN_DRAFTER` rather than throwing or guessing: a missing
 * attribution is a real state that must be recordable and countable, and it
 * must never be silently folded into a real model's numbers.
 */
export function drafterId(provider: unknown, model: unknown): string {
  if (!isDrafterProvider(provider)) return UNKNOWN_DRAFTER;
  const cleaned = normalizeModel(model);
  if (!cleaned) return UNKNOWN_DRAFTER;
  return `${provider}:${cleaned}`.slice(0, MAX_DRAFTER_ID_LENGTH);
}

/** Split a stored id back apart. Null when it is not a real attribution. */
export function parseDrafterId(
  id: string,
): { provider: DrafterProvider; model: string } | null {
  const at = id.indexOf(":");
  if (at <= 0) return null;
  const provider = id.slice(0, at);
  const model = id.slice(at + 1);
  if (!isDrafterProvider(provider) || !model) return null;
  return { provider, model };
}

export function isAttributed(id: string): boolean {
  return parseDrafterId(id) !== null;
}

/**
 * Model names arrive from provider APIs and from env overrides, so they are
 * untrusted strings. Lowercased and stripped of anything outside a safe set so
 * that two spellings of one model do not become two rows in the scoreboard.
 */
function normalizeModel(model: unknown): string | null {
  if (typeof model !== "string") return null;
  const cleaned = model
    .trim()
    .toLowerCase()
    // Provider prefixes some APIs echo back ("models/gemini-…").
    .replace(/^models\//, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || null;
}
