/**
 * The contract red-flag summariser — pure normalisation of whatever the model
 * hands back, kept separate from ai.ts so the actual shaping logic is
 * testable without a live model call (this codebase has no precedent for
 * mocking an LLM in a unit test; every AI-calling function in ai.ts is
 * untested, and every genuinely testable piece around it lives in its own
 * pure module instead — this file is that piece for contract analysis).
 *
 * Deliberately narrow: a clause is either something that favours the reader
 * or something that should give them pause, in one sentence each, quoting the
 * actual text. No score, no verdict on "should you sign" — that is a legal
 * judgment call this function does not make and the product does not either.
 */

export const MAX_CLAUSES = 20;
const MAX_FIELD_CHARS = 300;

export type ClauseRisk = "green" | "red";

export interface ContractClause {
  /** The clause itself, quoted or closely paraphrased. */
  quote: string;
  risk: ClauseRisk;
  /** One sentence: why this favours the reader, or why it should give pause. */
  explanation: string;
}

export interface ContractAnalysis {
  clauses: ContractClause[];
  /** False when the input didn't look like a contract at all. */
  readable: boolean;
  /** True when the model found an auto-renewal clause, regardless of whether a date was extractable. */
  autoRenews: boolean;
  /** ISO yyyy-mm-dd renewal/expiry date, only when the model found one AND it parses as a real date. Never invented. */
  renewalDate: string | null;
  /**
   * Days of advance written notice the contract requires, when stated.
   *
   * This is the number that actually decides whether a term rolls: a renewal
   * date without it tells you when it is already too late. Null when the
   * contract does not state one — a customary default guessed here would
   * produce a confident deadline that is wrong, and someone would plan
   * around it.
   */
  noticeDays: number | null;
}

function truncate(s: string): string {
  return s.length > MAX_FIELD_CHARS ? s.slice(0, MAX_FIELD_CHARS) : s;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The model is asked for yyyy-mm-dd but nothing stops it from returning
 * "next month" or a malformed string — validate the shape AND that it's a
 * real calendar date (Date silently rolls "2026-02-30" into March) before
 * ever letting a caller build a Deadline reminder from it.
 */
function normalizeRenewalDate(raw: unknown): string | null {
  if (typeof raw !== "string" || !ISO_DATE_RE.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  // Reject a date that round-trips to a different day (e.g. Feb 30 -> Mar 2).
  return d.toISOString().slice(0, 10) === raw ? raw : null;
}

function normalizeClause(raw: unknown): ContractClause | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const quote = typeof r.quote === "string" ? truncate(r.quote.trim()) : "";
  const explanation = typeof r.explanation === "string" ? truncate(r.explanation.trim()) : "";
  const risk: ClauseRisk | null = r.risk === "red" ? "red" : r.risk === "green" ? "green" : null;
  if (!quote || !explanation || !risk) return null;
  return { quote, risk, explanation };
}

/**
 * Turn whatever the model returned (already JSON-parsed, so still fully
 * untrusted shape-wise) into a bounded, well-formed result. A clause missing
 * any required field is dropped rather than shown half-empty; a response
 * that isn't shaped like the expected object at all reads as "not readable"
 * rather than throwing, since a malformed model response is not the same
 * failure as an unreadable contract and the UI has only one thing to say
 * about either: try again.
 */
export function normalizeContractAnalysis(parsed: unknown): ContractAnalysis {
  if (!parsed || typeof parsed !== "object")
    return { clauses: [], readable: false, autoRenews: false, renewalDate: null, noticeDays: null };
  const p = parsed as Record<string, unknown>;
  const clauses = Array.isArray(p.clauses)
    ? p.clauses
        .map(normalizeClause)
        .filter((c): c is ContractClause => c !== null)
        .slice(0, MAX_CLAUSES)
    : [];
  return {
    clauses,
    readable: Boolean(p.readable),
    autoRenews: Boolean(p.autoRenews),
    renewalDate: normalizeRenewalDate(p.renewalDate),
    noticeDays: normalizeNoticeDays((p as { noticeDays?: unknown }).noticeDays),
  };
}


/**
 * A notice period only survives if it is a plausible whole number of days.
 *
 * Anything negative, fractional, or longer than two years is a
 * misinterpretation rather than a term, and letting one through would set a
 * deadline in the wrong place — which is the single failure this feature
 * cannot afford.
 */
function normalizeNoticeDays(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const days = Math.round(v);
  if (days < 0 || days > 730) return null;
  return days;
}
