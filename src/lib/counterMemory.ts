/**
 * Your file on them.
 *
 * THE ASYMMETRY THIS CLOSES
 *
 * Every institution keeps a memory of the person: payment history, credit
 * score, customer profile, how much friction it takes before they give up.
 * The person keeps nothing about the institution. Each time they come back
 * they start from zero, against a counterparty that did not.
 *
 * `companyScore.ts` already aggregates outcomes ACROSS users into public,
 * de-identified statistics. That is a different artifact with a different
 * purpose: it is evidence about a company for everyone. This is the private
 * inverse — one person's own history with one counterparty, which is theirs,
 * needs no other user's data, and needs no cooperation from the institution
 * itself. Nothing here depends on a bank granting access.
 *
 * THE DISTINCTION THAT MAKES IT HONEST
 *
 * "They ignored you" is a serious claim, and it is only true if something
 * actually reached them. With no SMTP configured every Outbox row sits at
 * QUEUED, so a version of this that counted "sent" as "we created a letter"
 * would tell thousands of people they were ignored by companies that were
 * never contacted. `deliveredAt` is therefore the only thing that starts the
 * clock, and a queued letter is reported as our own outstanding work.
 */

/** One outreach attempt against a counterparty, from this user's history. */
export interface OutreachRecord {
  counterparty: string;
  /** When the letter actually left the system. Null while it is only queued. */
  deliveredAt: Date | null;
  /** When the counterparty responded in any way. Null if they never did. */
  repliedAt: Date | null;
  /** A documented saving resulted. Never inferred from a reply alone. */
  saved: boolean;
  /** Recovered amount in minor units; 0 when nothing came back. */
  recoveredMinor: number;
  /** Negotiation stance used, when the case carried one. */
  variantId?: string | null;
}

export interface CounterpartyMemory {
  counterparty: string;
  /** Letters that actually reached them. The denominator for every rate below. */
  delivered: number;
  /** Letters still sitting in our own outbox. Our backlog, not their silence. */
  undelivered: number;
  replied: number;
  /** Delivered, past the silence window, still no reply. */
  ignored: number;
  saved: number;
  recoveredMinor: number;
  /** Median days from delivery to reply, among those who replied. */
  medianReplyDays: number | null;
  /**
   * Stances that produced a documented saving here, most wins first. What
   * actually worked against this counterparty, for this person.
   */
  winningVariants: { variantId: string; wins: number }[];
  /** First and last time this person went at them. */
  firstContactAt: Date | null;
  lastContactAt: Date | null;
}

/**
 * How long a delivered letter may go unanswered before silence is called
 * silence. Below this it is simply too early to say, and saying it anyway
 * would put a false accusation into someone's own records.
 */
export const SILENCE_AFTER_DAYS = 21;

const DAY_MS = 86_400_000;

export function buildCounterMemory(
  records: readonly OutreachRecord[],
  now: Date = new Date(),
): CounterpartyMemory[] {
  const groups = new Map<string, OutreachRecord[]>();
  for (const r of records) {
    const key = normalize(r.counterparty);
    if (!key) continue;
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }

  const out = [...groups.entries()].map(([counterparty, list]) =>
    memoryFor(counterparty, list, now),
  );

  // Most-engaged counterparty first: that is where the history is worth
  // reading, and where the next letter benefits most from it.
  return out.sort(
    (a, b) => b.delivered - a.delivered || b.recoveredMinor - a.recoveredMinor,
  );
}

function memoryFor(
  counterparty: string,
  list: readonly OutreachRecord[],
  now: Date,
): CounterpartyMemory {
  const delivered = list.filter((r) => r.deliveredAt !== null);
  const replied = delivered.filter((r) => r.repliedAt !== null);

  const ignored = delivered.filter(
    (r) =>
      r.repliedAt === null &&
      (now.getTime() - (r.deliveredAt as Date).getTime()) / DAY_MS >= SILENCE_AFTER_DAYS,
  );

  const replyDays = replied.map((r) =>
    Math.max(0, Math.round(((r.repliedAt as Date).getTime() - (r.deliveredAt as Date).getTime()) / DAY_MS)),
  );

  const wins = new Map<string, number>();
  for (const r of delivered) {
    if (!r.saved) continue;
    const v = r.variantId?.trim();
    if (!v) continue;
    wins.set(v, (wins.get(v) ?? 0) + 1);
  }

  const contactDates = delivered
    .map((r) => r.deliveredAt as Date)
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    counterparty,
    delivered: delivered.length,
    undelivered: list.length - delivered.length,
    replied: replied.length,
    ignored: ignored.length,
    saved: delivered.filter((r) => r.saved).length,
    // Integer minor units only; no float ever touches money.
    recoveredMinor: list.reduce((s, r) => s + Math.max(0, Math.round(r.recoveredMinor)), 0),
    medianReplyDays: median(replyDays),
    winningVariants: [...wins.entries()]
      .map(([variantId, w]) => ({ variantId, wins: w }))
      .sort((a, b) => b.wins - a.wins || a.variantId.localeCompare(b.variantId)),
    firstContactAt: contactDates[0] ?? null,
    lastContactAt: contactDates[contactDates.length - 1] ?? null,
  };
}

/**
 * A sentence this person can put in their next letter, or null when the
 * history does not support one.
 *
 * Returns a structured claim rather than prose so the caller renders it
 * through next-intl — and so nothing here can invent a number. Every field is
 * a count of things that actually happened.
 */
export interface HistoryClaim {
  kind: "ignored_before" | "slow_to_reply" | "resolved_before";
  counterparty: string;
  count: number;
  /** Only set for "slow_to_reply". */
  medianReplyDays?: number;
}

export function historyClaim(memory: CounterpartyMemory): HistoryClaim | null {
  // Being ignored before is the most useful thing to be able to say, and the
  // one a company can least easily dispute — it is their own silence.
  if (memory.ignored > 0) {
    return { kind: "ignored_before", counterparty: memory.counterparty, count: memory.ignored };
  }
  if (memory.medianReplyDays !== null && memory.medianReplyDays > SILENCE_AFTER_DAYS) {
    return {
      kind: "slow_to_reply",
      counterparty: memory.counterparty,
      count: memory.replied,
      medianReplyDays: memory.medianReplyDays,
    };
  }
  if (memory.saved > 0) {
    return { kind: "resolved_before", counterparty: memory.counterparty, count: memory.saved };
  }
  return null;
}

/** True when this person has any history worth showing for a counterparty. */
export function hasMemory(memory: CounterpartyMemory): boolean {
  return memory.delivered > 0 || memory.undelivered > 0;
}

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}
