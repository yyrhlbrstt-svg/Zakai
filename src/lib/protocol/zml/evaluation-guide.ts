import type { ZmlCondition, ZmlPredicate, ZmlRight } from "./types";

export interface EvaluationField {
  field: string;
  type: "string" | "number" | "boolean" | "enum";
  source: "user_input" | "bill_scan" | "external_api" | "calculation";
  required: boolean;
}

export interface EvaluationGuide {
  right_id: string;
  display_name: Record<string, string>;
  required_fields: EvaluationField[];
  predicate_structure: ZmlPredicate;
  template_preview: string | null;
  requires_human_gate: boolean;
  source: ZmlRight["source"];
  _links: {
    self: string;
    full_doc: string;
  };
}

function inferType(operator: string, value: unknown): EvaluationField["type"] {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (operator === "in") return "enum";
  return "string";
}

function traversePredicate(predicate: ZmlPredicate, fields: EvaluationField[]): void {
  for (const node of predicate.conditions) {
    if ("operator" in node && "conditions" in node) {
      traversePredicate(node as ZmlPredicate, fields);
    } else {
      const c = node as ZmlCondition;
      fields.push({
        field: c.field,
        type: inferType(c.operator, c.value),
        source: c.source ?? "user_input",
        required: true,
      });
    }
  }
}

export function extractFieldsFromPredicate(predicate: ZmlPredicate): EvaluationField[] {
  const fields: EvaluationField[] = [];
  traversePredicate(predicate, fields);
  return [...new Map(fields.map((f) => [f.field, f])).values()];
}

export function buildEvaluationGuide(right: ZmlRight): EvaluationGuide {
  return {
    right_id: right.id,
    display_name: right.display_name,
    required_fields: extractFieldsFromPredicate(right.predicate),
    predicate_structure: right.predicate,
    template_preview: right.action.template_ref ?? right.action.internal_tool ?? null,
    requires_human_gate: right.action.requires_human_gate ?? true,
    source: right.source,
    _links: {
      self: `/api/rights/evaluate/${right.id}`,
      full_doc: `/api/rights/catalog/${right.id}?full=1`,
    },
  };
}

/** `il_tax_refund` → CDN folder `il`, catalog market `IL`. */
export function marketFromZmlId(id: string): string {
  const prefix = id.split("_")[0]?.toLowerCase();
  if (prefix === "il") return "IL";
  if (prefix === "eu") return "EU";
  if (prefix?.length === 2) return prefix.toUpperCase();
  return "IL";
}
