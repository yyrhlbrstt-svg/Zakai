/**
 * Rights Graph v1 — the single typed home for "what is this person entitled
 * to, under which law, from whom, worth how much" (the KNOW atom).
 *
 * Design rules, from the master build plan and this repo's own doctrine:
 *  - No free-text conditions: triggers are a small typed predicate language
 *    with an evaluator and tests, so a machine can decide applicability.
 *  - No generated math: a remedy is either a fixed statutory cap or a tiny
 *    evaluated formula over named facts — never LLM output.
 *  - `verified` vs `draft` is load-bearing, not decorative: only `verified`
 *    entries can be resolved by letter-building code (see registry.ts), and
 *    a verified entry must carry a real source URL and a human-confirmed
 *    verification date. Uncertain law is encoded as `draft` with a
 *    TODO(source) — never guessed into `verified`.
 *  - Money is integer minor units (agorot / cents) only.
 *
 * This module is intentionally client-safe (pure data + pure functions):
 * cancellation letters are composed in the browser.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Facts and predicates
// ---------------------------------------------------------------------------

/** The facts of one case, as flat named values. Keys are declared per right. */
export type CaseFacts = Record<
  string,
  string | number | boolean | string[] | null | undefined
>;

export type FactOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  /** Array fact contains the value, or string fact contains the substring. */
  | "includes"
  /** Fact is present and neither null nor undefined. */
  | "exists";

export type Predicate =
  | { kind: "fact"; field: string; op: FactOp; value?: string | number | boolean }
  | { kind: "all"; of: Predicate[] }
  | { kind: "any"; of: Predicate[] }
  | { kind: "not"; of: Predicate };

/**
 * Evaluate one predicate over case facts.
 *
 * Missing facts fail closed: a right never applies because a fact was absent.
 * (`exists` is the one op that inspects absence itself, and `not` inverts
 * whatever its child concluded — including a fail-closed false.)
 */
export function evaluatePredicate(p: Predicate, facts: CaseFacts): boolean {
  switch (p.kind) {
    case "all":
      return p.of.every((child) => evaluatePredicate(child, facts));
    case "any":
      return p.of.some((child) => evaluatePredicate(child, facts));
    case "not":
      return !evaluatePredicate(p.of, facts);
    case "fact": {
      const v = facts[p.field];
      if (p.op === "exists") return v !== null && v !== undefined;
      if (v === null || v === undefined) return false;
      switch (p.op) {
        case "eq":
          return v === p.value;
        case "neq":
          return v !== p.value;
        case "gt":
          return typeof v === "number" && typeof p.value === "number" && v > p.value;
        case "gte":
          return typeof v === "number" && typeof p.value === "number" && v >= p.value;
        case "lt":
          return typeof v === "number" && typeof p.value === "number" && v < p.value;
        case "lte":
          return typeof v === "number" && typeof p.value === "number" && v <= p.value;
        case "includes":
          if (Array.isArray(v)) return v.includes(p.value as string);
          if (typeof v === "string" && typeof p.value === "string") return v.includes(p.value);
          return false;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Remedy formulas — evaluated, never generated
// ---------------------------------------------------------------------------

/**
 * The whole formula language, deliberately: `min(<fact>, cap)`, `<fact>`, or
 * absent (pure statutory cap). `<fact>` values are integer minor units.
 * Anything else is a validation error at load time, not a runtime surprise.
 */
const FORMULA_RE = /^(?:min\(\s*([a-z_][a-z0-9_]*)\s*,\s*cap\s*\)|([a-z_][a-z0-9_]*))$/;

export function isValidFormula(formula: string): boolean {
  return FORMULA_RE.test(formula);
}

/**
 * Evaluate a remedy amount in minor units, or null when the needed fact is
 * missing/invalid — a right with an uncomputable remedy is shown without an
 * amount, never with an invented one.
 */
export function evaluateRemedyMinor(
  remedy: { formula?: string; capMinor?: number },
  facts: CaseFacts,
): number | null {
  if (!remedy.formula) return remedy.capMinor ?? null;
  const m = FORMULA_RE.exec(remedy.formula);
  if (!m) return null;
  const field = m[1] ?? m[2];
  const raw = facts[field];
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return null;
  const value = Math.round(raw);
  if (m[1]) {
    // min(fact, cap) — cap is required by the validator for this form.
    if (typeof remedy.capMinor !== "number") return null;
    return Math.min(value, remedy.capMinor);
  }
  return value;
}

// ---------------------------------------------------------------------------
// The Right
// ---------------------------------------------------------------------------

export const LocalizedSchema = z.object({
  he: z.string().min(1),
  en: z.string().min(1),
  ar: z.string().min(1).optional(),
  ru: z.string().min(1).optional(),
  de: z.string().min(1).optional(),
  fr: z.string().min(1).optional(),
});
export type Localized = z.infer<typeof LocalizedSchema>;

const FactOpSchema = z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "includes", "exists"]);

export const PredicateSchema: z.ZodType<Predicate> = z.lazy(() =>
  z.union([
    z.object({
      kind: z.literal("fact"),
      field: z.string().regex(/^[a-z_][a-z0-9_]*$/),
      op: FactOpSchema,
      value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    }),
    z.object({ kind: z.literal("all"), of: z.array(PredicateSchema).min(1) }),
    z.object({ kind: z.literal("any"), of: z.array(PredicateSchema).min(1) }),
    z.object({ kind: z.literal("not"), of: PredicateSchema }),
  ]),
);

export const RightSchema = z
  .object({
    /** e.g. "il.consumer.31a.continued-billing-after-cancellation" */
    id: z.string().regex(/^[a-z]{2}\.[a-z0-9-]+(\.[a-z0-9-]+)+$/),
    jurisdiction: z.string().min(2).max(4),
    domain: z.enum(["telecom", "banking", "subscriptions", "electricity", "flights"]),
    title: LocalizedSchema,
    statute: z.object({
      name: z.string().min(1),
      section: z.string().min(1),
      sourceUrl: z.string().url(),
      /** Date of the consolidated text this entry was written against. */
      version: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      /** ISO date a human last confirmed the entry against the source. */
      lastVerifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    trigger: z.array(PredicateSchema).min(1),
    obligor: z.object({
      type: z.enum(["provider", "regulator", "state"]),
      directoryRef: z.string().min(1),
    }),
    remedy: z.object({
      kind: z.enum([
        "refund",
        "statutory_damages",
        "cancellation",
        "records",
        "compensation_formula",
      ]),
      formula: z.string().optional(),
      capMinor: z.number().int().positive().optional(),
      currency: z.enum(["ILS", "EUR"]),
    }),
    procedure: z.object({
      channel: z.enum(["letter", "portal", "form"]),
      recipientDirectoryRef: z.string().min(1),
      responseDeadlineDays: z.number().int().positive().max(120),
      evidenceRequired: z.array(z.string().min(1)),
    }),
    escalation: z.array(z.string().min(1)).min(1),
    status: z.enum(["verified", "draft"]),
    /** Required on drafts: what stops this from being verified. */
    todoSource: z.string().optional(),
  })
  .superRefine((right, ctx) => {
    if (right.remedy.formula && !isValidFormula(right.remedy.formula)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["remedy", "formula"],
        message: `formula must match min(<fact>, cap) or <fact>; got "${right.remedy.formula}"`,
      });
    }
    if (right.remedy.formula?.startsWith("min(") && right.remedy.capMinor === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["remedy", "capMinor"],
        message: "a min(_, cap) formula requires capMinor",
      });
    }
    if (right.status === "draft" && !right.todoSource) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["todoSource"],
        message: "a draft right must say what source is missing (TODO(source))",
      });
    }
    if (right.status === "verified" && right.todoSource) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["todoSource"],
        message: "a verified right cannot carry an open TODO(source)",
      });
    }
  });

export type Right = z.infer<typeof RightSchema>;

/** Does this right apply to these facts? All top-level triggers must hold. */
export function rightApplies(right: Right, facts: CaseFacts): boolean {
  return right.trigger.every((p) => evaluatePredicate(p, facts));
}
