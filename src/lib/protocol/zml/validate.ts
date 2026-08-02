import type { ZmlAction, ZmlCondition, ZmlPredicate, ZmlRight } from "./types";
import { ZML_VERSION } from "./constants";

const ID_PATTERN = /^[a-z0-9_]+$/;
const MARKET_PATTERN = /^[A-Z]{2}$/;
const CATEGORIES = new Set([
  "telecom",
  "energy",
  "finance",
  "transport",
  "insurance",
  "tax",
  "housing",
  "employment",
  "consumer_protection",
  "health",
  "education",
]);

function isPredicate(node: unknown): node is ZmlPredicate {
  if (!node || typeof node !== "object") return false;
  const o = node as ZmlPredicate;
  if (o.operator !== "AND" && o.operator !== "OR" && o.operator !== "NOT") return false;
  if (!Array.isArray(o.conditions)) return false;
  return o.conditions.every((c) => isPredicate(c) || isCondition(c));
}

function isCondition(node: unknown): node is ZmlCondition {
  if (!node || typeof node !== "object") return false;
  const c = node as ZmlCondition;
  return typeof c.field === "string" && typeof c.operator === "string" && "value" in c;
}

function validateAction(action: ZmlAction): string | null {
  const kinds = new Set(["letter", "form", "calculation", "claim", "appeal"]);
  if (!kinds.has(action.kind)) return "invalid action.kind";
  if (action.template_ref && action.template_ref.startsWith("http://")) {
    return "template_ref must use https";
  }
  return null;
}

/** Structural validation (no external JSON Schema runtime). */
export function validateZML(doc: unknown): { ok: true } | { ok: false; error: string } {
  if (!doc || typeof doc !== "object") return { ok: false, error: "not an object" };
  const r = doc as ZmlRight;

  if (r.zml_version !== ZML_VERSION) {
    return { ok: false, error: `zml_version must be ${ZML_VERSION}` };
  }
  if (typeof r.id !== "string" || !ID_PATTERN.test(r.id)) {
    return { ok: false, error: "invalid id" };
  }
  if (typeof r.market !== "string" || !MARKET_PATTERN.test(r.market)) {
    return { ok: false, error: "invalid market" };
  }
  if (!r.display_name || typeof r.display_name.en !== "string") {
    return { ok: false, error: "display_name.en required" };
  }
  if (!CATEGORIES.has(r.category)) return { ok: false, error: "invalid category" };
  if (!isPredicate(r.predicate)) return { ok: false, error: "invalid predicate" };
  if (!r.source || typeof r.source.reference !== "string") {
    return { ok: false, error: "invalid source" };
  }
  const actionErr = validateAction(r.action);
  if (actionErr) return { ok: false, error: actionErr };

  if (r.financial?.estimate) {
    for (const v of Object.values(r.financial.estimate)) {
      if (typeof v === "number" && !Number.isInteger(v)) {
        return { ok: false, error: "financial amounts must be integers (minor units)" };
      }
    }
  }

  return { ok: true };
}
