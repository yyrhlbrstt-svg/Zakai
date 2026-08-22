import "server-only";

import { MockOpenBankingProvider } from "./mock";
import { FinandaOpenBankingProvider, finandaConfig } from "./finanda";
import type { OpenBankingProvider } from "./types";

/**
 * Which provider is in play, decided once, from the environment.
 *
 * THE RULE THIS FILE ENFORCES
 *
 * Selecting `finanda` without configuring it must never take the app down.
 * That is not politeness — it is the difference between a deploy where the
 * money page still works and one where it is a stack trace, and the failure
 * mode we are guarding against is precisely the plausible one: somebody sets
 * `OPEN_BANKING_PROVIDER=finanda` the day the contract is signed, before the
 * credentials land in Vercel.
 *
 * So an unconfigured live provider falls back to the mock and says so loudly,
 * once, in the logs. Loudly matters: a silent fallback would mean shipping
 * fixture data to real users while every dashboard read green.
 */

export type ProviderName = "mock" | "finanda";

let warned = false;

function warnOnce(message: string) {
  if (warned) return;
  warned = true;
  console.warn(`[open-banking] ${message}`);
}

/** Exported for tests and for the UI's honest "which provider" disclosure. */
export function selectProvider(
  requested: string | undefined,
  config: ReturnType<typeof finandaConfig>,
): { provider: OpenBankingProvider; fellBack: boolean; requested: ProviderName } {
  const want: ProviderName = requested?.trim().toLowerCase() === "finanda" ? "finanda" : "mock";

  if (want === "finanda") {
    if (config) {
      return { provider: new FinandaOpenBankingProvider(config), fellBack: false, requested: want };
    }
    return { provider: new MockOpenBankingProvider(), fellBack: true, requested: want };
  }
  return { provider: new MockOpenBankingProvider(), fellBack: false, requested: want };
}

export function openBankingProvider(): OpenBankingProvider {
  const { provider, fellBack } = selectProvider(process.env.OPEN_BANKING_PROVIDER, finandaConfig());
  if (fellBack) {
    warnOnce(
      "OPEN_BANKING_PROVIDER=finanda but FINANDA_BASE_URL / FINANDA_CLIENT_ID / " +
        "FINANDA_CLIENT_SECRET are not all set. Falling back to the MOCK provider — " +
        "every figure produced from it is fixture data, not anybody's real account.",
    );
  }
  return provider;
}

/**
 * Is the data a person is looking at real?
 *
 * Every surface that renders account data has to be able to answer this, so it
 * is derived from the provider itself rather than re-read from the env in each
 * component — the two could disagree, and the component would be the one
 * telling the user.
 */
export function providerIsLive(): boolean {
  return openBankingProvider().isLive;
}

export type { OpenBankingProvider } from "./types";
