/**
 * Priority scoring for dashboard / empty-state action doors.
 * Agentic money paths (scan, cancel, owed, bank-fees, electricity) get a boost
 * so users land on loops that close with Mandate + SavingsProof.
 */

export type PriorityDoor = {
  href: string;
  key: string;
  score: number;
};

const BASE: PriorityDoor[] = [
  { href: "/money", key: "money", score: 100 },
  { href: "/cancel", key: "cancel", score: 95 },
  { href: "/what-am-i-owed", key: "whatAmIOwed", score: 90 },
  { href: "/bank-fees", key: "bankfees", score: 88 },
  { href: "/electricity", key: "electricity", score: 86 },
  { href: "/leaks", key: "leaks", score: 80 },
  { href: "/refund-chase", key: "refundchase", score: 75 },
  { href: "/flights", key: "flights", score: 70 },
  { href: "/parking", key: "parking", score: 65 },
  { href: "/scan", key: "scan", score: 60 },
  { href: "/score", key: "score", score: 50 },
  { href: "/proofs", key: "proofs", score: 40 },
];

/** Agentic boost applied when the user has no active cases (empty dashboard). */
const AGENTIC_BOOST: Record<string, number> = {
  money: 25,
  cancel: 20,
  whatAmIOwed: 18,
  bankfees: 15,
  electricity: 15,
  leaks: 10,
  refundchase: 8,
};

export function priorityDoors(opts?: { empty?: boolean; limit?: number }): PriorityDoor[] {
  const empty = opts?.empty ?? false;
  const limit = opts?.limit ?? 6;
  const scored = BASE.map((d) => ({
    ...d,
    score: d.score + (empty ? AGENTIC_BOOST[d.key] ?? 0 : 0),
  }));
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function agenticBoostKeys(): string[] {
  return Object.keys(AGENTIC_BOOST);
}
