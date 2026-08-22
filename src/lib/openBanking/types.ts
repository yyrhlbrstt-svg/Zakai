/**
 * Open Banking — the provider-agnostic contract.
 *
 * WHY THE SHAPE IS NOT OURS
 *
 * These types deliberately mirror Berlin Group / NextGenPSD2, which is the
 * standard the Bank of Israel published for the Financial Information Service
 * regime and therefore the shape our real provider will hand us. Inventing a
 * prettier internal shape here would feel cleaner for about a week and then
 * cost a translation layer with its own bugs at exactly the moment we are
 * swapping in a live provider under contract pressure.
 *
 * So the ugliness is on purpose, and it is load-bearing:
 *
 *  - Amounts are DECIMAL STRINGS ("-89.90"), not numbers. That is what the
 *    standard sends. Parsing them into integer agorot happens once, at the
 *    boundary, in `parseAmountToAgorot` — never by sprinkling Number() around,
 *    which is how float creeps into money in a codebase that forbids it.
 *  - Dates are ISO date strings ("2026-06-05"), not Date objects, because that
 *    is what arrives over the wire and re-serialising is a lie about origin.
 *  - Field names are the standard's, so a Finanda payload can be validated
 *    against these types directly rather than after a rename pass.
 *
 * WHAT THIS INTERFACE MAY NEVER GROW
 *
 * Read verbs only. There is no initiate, no transfer, no standing-order write.
 * The Mandate protocol forbids outward money movement at the scope level
 * (`FORBIDDEN_SCOPES`), and this interface is the other half of that promise:
 * even if a provider offers payment initiation, Zakai has nowhere to put it.
 */

/** ISO 8601 calendar date, "YYYY-MM-DD". */
export type IsoDate = string;

/** Berlin Group amount: currency plus a decimal string. Never a float. */
export interface Amount {
  currency: string;
  /** Decimal string, e.g. "-89.90". Negative = money leaving the account. */
  amount: string;
}

export type AccountType = "CACC" | "CARD";

/**
 * An account, as the standard describes one.
 *
 * `iban` is present for bank accounts and absent for cards; `maskedPan` is the
 * reverse. Both are optional rather than a union because that is how the
 * payload arrives, and pretending otherwise would mean rejecting valid data.
 */
export interface OpenBankingAccount {
  /** Opaque provider-side id — the handle for every other call. */
  resourceId: string;
  iban?: string;
  maskedPan?: string;
  currency: string;
  /** Account holder's own label, when the bank exposes one. */
  name?: string;
  product?: string;
  cashAccountType: AccountType;
  status?: "enabled" | "deleted" | "blocked";
}

export type BalanceType = "closingBooked" | "expected" | "interimAvailable";

export interface OpenBankingBalance {
  balanceAmount: Amount;
  balanceType: BalanceType;
  referenceDate?: IsoDate;
}

export interface OpenBankingTransaction {
  transactionId: string;
  bookingDate: IsoDate;
  valueDate?: IsoDate;
  transactionAmount: Amount;
  /** Who was paid. For a card charge this is the merchant. */
  creditorName?: string;
  debtorName?: string;
  /** Free-text description — often the only place the merchant appears. */
  remittanceInformationUnstructured?: string;
  /** ISO 20022 bank transaction code, when the bank sends one. */
  bankTransactionCode?: string;
  /** The bank's own category string. Advisory only; we classify ourselves. */
  proprietaryBankTransactionCode?: string;
}

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

/**
 * Every provider implements exactly this, and nothing else.
 *
 * `userId` is passed rather than held so a provider stays stateless from our
 * side: the consent/token lookup belongs to the implementation, and a mock
 * that ignores it must still be swappable for one that does not.
 */
export interface OpenBankingProvider {
  /** Stable identifier for logs and the UI's "which provider" disclosure. */
  readonly id: "mock" | "finanda" | "silvernet";
  /** False for anything not backed by a real licensed connection. */
  readonly isLive: boolean;

  getAccounts(userId: string): Promise<OpenBankingAccount[]>;
  getBalance(accountId: string): Promise<OpenBankingBalance[]>;
  getTransactions(accountId: string, range: DateRange): Promise<OpenBankingTransaction[]>;
}

export class OpenBankingError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "unauthorized" | "upstream" | "not_found",
  ) {
    super(message);
    this.name = "OpenBankingError";
  }
}

/**
 * Decimal string -> integer agorot, without ever touching a float.
 *
 * `Number("89.90") * 100` is 8989.999999999998 for some inputs, and money in
 * this codebase is integer minor units precisely so that class of bug cannot
 * exist. So the string is taken apart by hand: sign, whole part, fraction
 * padded or truncated to exactly two digits, then integer arithmetic.
 *
 * Returns null rather than 0 on anything unparseable. A charge we cannot read
 * is not a charge of zero, and silently calling it zero would understate what
 * somebody is owed — the one direction this codebase must never round.
 */
export function parseAmountToAgorot(amount: string): number | null {
  const raw = String(amount ?? "").trim();
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!m) return null;
  const [, sign, whole, fraction = ""] = m;
  const twoDigits = (fraction + "00").slice(0, 2);
  const agorot = Number(whole) * 100 + Number(twoDigits);
  if (!Number.isSafeInteger(agorot)) return null;
  return sign === "-" ? -agorot : agorot;
}

/** The merchant, from whichever field this bank actually populated. */
export function merchantOf(txn: OpenBankingTransaction): string {
  return (
    txn.creditorName?.trim() ||
    txn.remittanceInformationUnstructured?.trim() ||
    txn.debtorName?.trim() ||
    ""
  );
}
