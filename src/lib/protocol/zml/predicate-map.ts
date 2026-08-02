import type { Predicate } from "@/lib/global/types";
import type { ZmlCondition, ZmlPredicate } from "./types";

function numCondition(
  field: string,
  gte?: number,
  lte?: number,
): ZmlCondition | ZmlPredicate | null {
  const parts: ZmlCondition[] = [];
  if (gte !== undefined) parts.push({ field, operator: "gte", value: gte, source: "user_input" });
  if (lte !== undefined) parts.push({ field, operator: "lte", value: lte, source: "user_input" });
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return { operator: "AND", conditions: parts };
}

/** Map the internal declarative `Predicate` tree to ZML (L0 only). */
export function predicateToZml(p: Predicate): ZmlPredicate {
  switch (p.kind) {
    case "always":
      return { operator: "AND", conditions: [] };
    case "never":
      return {
        operator: "AND",
        conditions: [{ field: "_never", operator: "eq", value: true, source: "calculation" }],
      };
    case "all":
      return { operator: "AND", conditions: p.of.map(predicateToZml) };
    case "any":
      return { operator: "OR", conditions: p.of.map(predicateToZml) };
    case "not":
      return { operator: "NOT", conditions: [predicateToZml(p.of)] };
    case "num": {
      const c = numCondition(p.field, p.gte, p.lte);
      if (!c) return { operator: "AND", conditions: [] };
      return "operator" in c && (c.operator === "AND" || c.operator === "OR" || c.operator === "NOT")
        ? c
        : { operator: "AND", conditions: [c] };
    }
    case "bool":
      return {
        operator: "AND",
        conditions: [
          { field: p.field, operator: "eq", value: p.is, source: "user_input" },
        ],
      };
    case "enum":
      return {
        operator: "AND",
        conditions: [{ field: p.field, operator: "in", value: p.in, source: "user_input" }],
      };
    case "extra":
      return {
        operator: "AND",
        conditions: [
          {
            field: `extra.${p.key}`,
            operator: "eq",
            value: p.equals,
            source: "user_input",
          },
        ],
      };
    case "extraBool":
      return {
        operator: "AND",
        conditions: [
          {
            field: `extra.${p.key}`,
            operator: "eq",
            value: p.is,
            source: "user_input",
          },
        ],
      };
  }
}

export function summarizePredicate(p: Predicate): string {
  switch (p.kind) {
    case "always":
      return "Always eligible (subject to verification)";
    case "never":
      return "Not eligible";
    case "all":
      return p.of.map(summarizePredicate).join(" AND ");
    case "any":
      return `(${p.of.map(summarizePredicate).join(" OR ")})`;
    case "not":
      return `NOT (${summarizePredicate(p.of)})`;
    case "num": {
      const bits: string[] = [];
      if (p.gte !== undefined) bits.push(`${p.field} ≥ ${p.gte}`);
      if (p.lte !== undefined) bits.push(`${p.field} ≤ ${p.lte}`);
      return bits.join(", ") || p.field;
    }
    case "bool":
      return `${p.field} = ${p.is}`;
    case "enum":
      return `${p.field} in [${p.in.join(", ")}]`;
    case "extra":
      return `extra.${p.key} = ${String(p.equals)}`;
    case "extraBool":
      return `extra.${p.key} = ${p.is}`;
  }
}
