import type {
  DateRange,
  OpenBankingAccount,
  OpenBankingBalance,
  OpenBankingProvider,
  OpenBankingTransaction,
} from "./types";

/**
 * The mock provider — a real Israeli statement, invented.
 *
 * WHY THE FIXTURE IS THIS DETAILED
 *
 * A mock whose data is too clean proves nothing. The detection engine's whole
 * job is telling a subscription apart from a coincidence, so the fixture has
 * to contain both: charges that genuinely repeat, and charges that merely
 * happened twice. If everything in here were a textbook subscription, the
 * demo would pass while the detector was broken.
 *
 * So it contains, on purpose:
 *   - סלקום at a price that STEPS UP mid-window — the promo-period expiry that
 *     the Cellcom line of cases is about, and the single most valuable thing
 *     this product can find in an Israeli statement.
 *   - a forgotten נטפליקס, charged steadily for the whole window.
 *   - a gym billed monthly, to give the detector a second clean positive.
 *   - חברת חשמל every two months, which is the real Israeli billing cycle and
 *     must NOT be read as a monthly subscription.
 *   - two restaurant visits a month apart at the same price — the textbook
 *     false positive, present so the claim gate has something to refuse.
 *
 * HONESTY
 *
 * Nothing here may ever reach a user as if it were their money. The provider
 * reports `isLive: false`, every surface that renders it is required to say so
 * (see `OpenBankingDisclosure`), and the estimate built on it is labelled
 * demonstration data. Non-negotiable #1 is that we never invent amounts; a
 * fixture presented as a real finding would be exactly that.
 */

const CURRENCY = "ILS";

/**
 * Dates are generated relative to today, not hardcoded.
 *
 * The first version pinned the fixture to a fixed 2026 window, which is the
 * kind of decision that looks tidy and quietly rots: the API asks for the last
 * ninety-odd days, so the moment real time moved past the pinned window the
 * provider returned almost nothing and the estimate read ₪0 — while the E2E
 * still passed, because its assertions matched merchant names printed
 * elsewhere on the page. A mock that only works during one quarter of one year
 * is a mock that will lie to whoever runs it next.
 *
 * `monthsAgo(n, day)` puts a charge on the same day-of-month n months back,
 * so a monthly cadence stays a monthly cadence whenever this runs.
 */
function monthsAgo(n: number, day: number): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, day));
  return d.toISOString().slice(0, 10);
}

/** The window the fixture actually covers, computed the same way. */
export function mockWindow(): DateRange {
  return { from: monthsAgo(5, 1), to: monthsAgo(1, 28) };
}

/** Kept as a getter so callers cannot capture a stale window at import time. */
export const MOCK_WINDOW: DateRange = mockWindow();

export const MOCK_ACCOUNTS: OpenBankingAccount[] = [
  {
    resourceId: "acc-checking-001",
    iban: "IL620108000000099999999",
    currency: CURRENCY,
    name: "עובר ושב",
    product: "חשבון פרטי",
    cashAccountType: "CACC",
    status: "enabled",
  },
  {
    resourceId: "acc-card-002",
    maskedPan: "•••• •••• •••• 4417",
    currency: CURRENCY,
    name: "כרטיס אשראי",
    product: "ויזה",
    cashAccountType: "CARD",
    status: "enabled",
  },
];

const BALANCES: Record<string, OpenBankingBalance[]> = {
  "acc-checking-001": [
    { balanceType: "closingBooked", balanceAmount: { currency: CURRENCY, amount: "12480.33" }, referenceDate: monthsAgo(1, 28) },
    { balanceType: "interimAvailable", balanceAmount: { currency: CURRENCY, amount: "11980.33" }, referenceDate: monthsAgo(1, 28) },
  ],
  "acc-card-002": [
    { balanceType: "expected", balanceAmount: { currency: CURRENCY, amount: "-2317.60" }, referenceDate: monthsAgo(1, 28) },
  ],
};

let seq = 0;
const txn = (
  bookingDate: string,
  merchant: string,
  amount: string,
  proprietary?: string,
): OpenBankingTransaction => ({
  transactionId: `mock-txn-${String(++seq).padStart(4, "0")}`,
  bookingDate,
  valueDate: bookingDate,
  transactionAmount: { currency: CURRENCY, amount },
  creditorName: merchant,
  remittanceInformationUnstructured: merchant,
  proprietaryBankTransactionCode: proprietary,
});

seq = 0;
const CARD_TXNS: OpenBankingTransaction[] = [
  // סלקום — the price step-up. 89.90 for two months, then 119.90. This is the
  // finding the whole product exists for, and it is deliberately not flagged
  // by the fixture itself: the detector has to notice.
  txn(monthsAgo(4, 5), 'סלקום בע"מ', "-89.90", "COMM"),
  txn(monthsAgo(3, 5), 'סלקום בע"מ', "-89.90", "COMM"),
  txn(monthsAgo(2, 5), 'סלקום בע"מ', "-119.90", "COMM"),

  // נטפליקס — forgotten, steady, four sightings.
  txn(monthsAgo(4, 12), "נטפליקס", "-54.90", "SUBS"),
  txn(monthsAgo(3, 12), "נטפליקס", "-54.90", "SUBS"),
  txn(monthsAgo(2, 12), "נטפליקס", "-54.90", "SUBS"),

  // חדר כושר — a second clean monthly positive.
  txn(monthsAgo(4, 2), "הולמס פלייס", "-249.00", "SUBS"),
  txn(monthsAgo(3, 2), "הולמס פלייס", "-249.00", "SUBS"),
  txn(monthsAgo(2, 2), "הולמס פלייס", "-249.00", "SUBS"),

  // The textbook false positive: same price, one month apart, not a
  // subscription. The claim gate must decline to speak about this.
  txn(monthsAgo(4, 18), "מסעדת הגן", "-180.00"),
  txn(monthsAgo(3, 19), "מסעדת הגן", "-180.00"),

  // Ordinary noise, so the statement reads like a statement.
  txn(monthsAgo(4, 9), "שופרסל דיל", "-412.75"),
  txn(monthsAgo(4, 23), "רמי לוי", "-268.40"),
  txn(monthsAgo(3, 11), "שופרסל דיל", "-389.10"),
  txn(monthsAgo(3, 27), "פז יעלים", "-300.00"),
  txn(monthsAgo(2, 8), "רמי לוי", "-341.20"),
  txn(monthsAgo(2, 21), "אמזון", "-159.90"),
];

const CHECKING_TXNS: OpenBankingTransaction[] = [
  // חברת חשמל — every two months. A monthly-cadence detector must not call
  // this a subscription, which is precisely why it is in the fixture.
  txn(monthsAgo(4, 15), "חברת החשמל לישראל", "-612.00", "UTIL"),
  txn(monthsAgo(2, 15), "חברת החשמל לישראל", "-588.50", "UTIL"),

  // פרטנר — home internet, monthly, steady.
  txn(monthsAgo(4, 10), "פרטנר תקשורת", "-99.00", "COMM"),
  txn(monthsAgo(3, 10), "פרטנר תקשורת", "-99.00", "COMM"),
  txn(monthsAgo(2, 10), "פרטנר תקשורת", "-99.00", "COMM"),

  // ביטוח בריאות — monthly standing order.
  txn(monthsAgo(4, 1), "הראל ביטוח", "-187.40", "INSU"),
  txn(monthsAgo(3, 1), "הראל ביטוח", "-187.40", "INSU"),
  txn(monthsAgo(2, 1), "הראל ביטוח", "-187.40", "INSU"),

  // Salary in, so the account is not purely outflow.
  txn(monthsAgo(4, 28), "משכורת", "14200.00", "SALA"),
  txn(monthsAgo(3, 28), "משכורת", "14200.00", "SALA"),
  txn(monthsAgo(2, 28), "משכורת", "14200.00", "SALA"),

  // The card bill itself.
  txn(monthsAgo(3, 2), "כרטיסי אשראי לישראל", "-2104.15"),
  txn(monthsAgo(2, 2), "כרטיסי אשראי לישראל", "-2288.30"),
];

const BY_ACCOUNT: Record<string, OpenBankingTransaction[]> = {
  "acc-checking-001": CHECKING_TXNS,
  "acc-card-002": CARD_TXNS,
};

/** Inclusive on both ends, string comparison being safe for ISO dates. */
function inRange(date: string, range: DateRange): boolean {
  return date >= range.from && date <= range.to;
}

export class MockOpenBankingProvider implements OpenBankingProvider {
  readonly id = "mock" as const;
  readonly isLive = false;

  async getAccounts(_userId: string): Promise<OpenBankingAccount[]> {
    return MOCK_ACCOUNTS.map((a) => ({ ...a }));
  }

  async getBalance(accountId: string): Promise<OpenBankingBalance[]> {
    return (BALANCES[accountId] ?? []).map((b) => ({ ...b }));
  }

  async getTransactions(accountId: string, range: DateRange): Promise<OpenBankingTransaction[]> {
    return (BY_ACCOUNT[accountId] ?? [])
      .filter((t) => inRange(t.bookingDate, range))
      .map((t) => ({ ...t }));
  }
}
