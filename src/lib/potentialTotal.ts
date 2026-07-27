/**
 * "How much am I owed?" — a fast, honest orientation total across Zakai's
 * verticals. A few yes/no answers map to conservative per-vertical potential
 * RANGES (never a single fabricated figure), summed into an "up to ₪X worth
 * checking" headline plus a breakdown that links to each tool to actually
 * verify. It mixes one-time, annual and lifetime figures deliberately — the
 * UI labels it as a ceiling to investigate, not a promise of payment.
 *
 * Ranges are intentionally conservative and derived from the same public facts
 * the individual verticals use. Deterministic and tested.
 */
export interface PotentialProfile {
  ownsHome: boolean;
  hasMortgage: boolean;
  hasPension: boolean;
  employed: boolean;
  hasPrivateInsurance: boolean;
  flewDelayed: boolean; // a flight delayed/cancelled in the last few years
  rents: boolean;
}

export interface PotentialItem {
  key: string; // vertical key (matches translations + href)
  href: string;
  lowShekels: number;
  highShekels: number;
}

export interface PotentialResult {
  items: PotentialItem[];
  totalLowShekels: number;
  totalHighShekels: number;
}

// Conservative per-vertical potential ranges (shekels). Low ends are
// deliberately modest so the total under-promises rather than over-promises.
const RANGES: Record<
  string,
  { href: string; low: number; high: number; when: (p: PotentialProfile) => boolean }
> = {
  arnona: { href: "/arnona", low: 500, high: 4_000, when: (p) => p.ownsHome },
  mortgage: { href: "/mortgage", low: 15_000, high: 80_000, when: (p) => p.hasMortgage },
  pension: { href: "/pension-fees", low: 20_000, high: 100_000, when: (p) => p.hasPension },
  dupinsurance: {
    href: "/duplicate-insurance",
    low: 1_000,
    high: 12_000,
    when: (p) => p.hasPrivateInsurance,
  },
  taxrefund: { href: "/taxrefund", low: 800, high: 5_000, when: (p) => p.employed },
  payslip: { href: "/payslip", low: 500, high: 4_000, when: (p) => p.employed },
  flights: { href: "/flights", low: 1_000, high: 3_500, when: (p) => p.flewDelayed },
  deposit: { href: "/rights", low: 0, high: 0, when: (p) => p.rents }, // guidance only, no €
  // Lost money applies to everyone — pension/insurance/accounts left behind.
  lostmoney: { href: "/lost-money", low: 0, high: 15_000, when: () => true },
};

export function computePotentialTotal(profile: PotentialProfile): PotentialResult {
  const items: PotentialItem[] = [];
  for (const [key, r] of Object.entries(RANGES)) {
    if (!r.when(profile)) continue;
    if (r.high === 0) continue; // pure-guidance verticals don't add to the total
    items.push({ key, href: r.href, lowShekels: r.low, highShekels: r.high });
  }
  // Highest-potential first, so the breakdown leads with the big wins.
  items.sort((a, b) => b.highShekels - a.highShekels);

  const totalLowShekels = items.reduce((s, i) => s + i.lowShekels, 0);
  const totalHighShekels = items.reduce((s, i) => s + i.highShekels, 0);

  return { items, totalLowShekels, totalHighShekels };
}
