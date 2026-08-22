import "server-only";

import {
  OpenBankingError,
  type DateRange,
  type OpenBankingAccount,
  type OpenBankingBalance,
  type OpenBankingProvider,
  type OpenBankingTransaction,
} from "./types";

/**
 * Finanda — the real licensed connection, not yet connected.
 *
 * WHAT THIS IS FOR
 *
 * Zakai is not incorporated yet, so there is no contract, no credentials and
 * no lawful connection to anybody's bank. This file exists so that the day
 * those arrive, the change is this file plus an env var — not a refactor of
 * every screen that touches account data.
 *
 * WHY IT THROWS INSTEAD OF RETURNING EMPTY
 *
 * An unconfigured provider that returns `[]` is indistinguishable from a
 * person with no accounts, and that is the worst possible failure: the app
 * would confidently tell somebody there is nothing to find. Throwing a typed
 * `not_configured` error lets the selector in `index.ts` fall back to the mock
 * loudly, and lets any future direct caller crash honestly rather than lie
 * quietly.
 *
 * THE CONTRACT WE ARE CODING AGAINST
 *
 * Berlin Group / NextGenPSD2 as published by the Bank of Israel, which is what
 * the Financial Information Service regime standardises on. That is why the
 * types in `./types` look the way they do; the endpoints below are the
 * standard's own paths, so the TODOs are about auth and hosts, not shape.
 */

interface FinandaConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

/**
 * Read config without throwing. Returns null when anything is missing, which
 * is the signal the selector uses to fall back.
 */
export function finandaConfig(): FinandaConfig | null {
  const baseUrl = process.env.FINANDA_BASE_URL?.trim();
  const clientId = process.env.FINANDA_CLIENT_ID?.trim();
  const clientSecret = process.env.FINANDA_CLIENT_SECRET?.trim();
  if (!baseUrl || !clientId || !clientSecret) return null;
  return { baseUrl, clientId, clientSecret };
}

export class FinandaOpenBankingProvider implements OpenBankingProvider {
  readonly id = "finanda" as const;
  readonly isLive = true;

  constructor(private readonly config: FinandaConfig) {}

  /**
   * TODO(finanda): exchange client credentials for an access token, and cache
   * it until expiry. The standard is OAuth2 client_credentials for the TPP,
   * plus a per-user consent id obtained during account linking — so this will
   * take a userId once the consent flow exists, and the consent id becomes the
   * thing stored against the user, never the token.
   */
  private async accessToken(): Promise<string> {
    throw new OpenBankingError(
      "Finanda access token exchange is not implemented — no contract or credentials yet",
      "not_configured",
    );
  }

  /**
   * TODO(finanda): GET {baseUrl}/v1/accounts with the consent id in
   * `Consent-ID` and the token in `Authorization`. The response body is
   * `{ accounts: [...] }` in Berlin Group shape, so the mapping is a field
   * pick rather than a translation.
   */
  async getAccounts(_userId: string): Promise<OpenBankingAccount[]> {
    await this.accessToken();
    throw new OpenBankingError("not implemented", "not_configured");
  }

  /** TODO(finanda): GET {baseUrl}/v1/accounts/{accountId}/balances */
  async getBalance(_accountId: string): Promise<OpenBankingBalance[]> {
    await this.accessToken();
    throw new OpenBankingError("not implemented", "not_configured");
  }

  /**
   * TODO(finanda): GET {baseUrl}/v1/accounts/{accountId}/transactions
   * with `dateFrom`, `dateTo` and `bookingStatus=booked`. Pending entries are
   * deliberately excluded: a pending charge can vanish, and a claim built on
   * one would be a claim about money that was never taken.
   */
  async getTransactions(_accountId: string, _range: DateRange): Promise<OpenBankingTransaction[]> {
    await this.accessToken();
    throw new OpenBankingError("not implemented", "not_configured");
  }
}
