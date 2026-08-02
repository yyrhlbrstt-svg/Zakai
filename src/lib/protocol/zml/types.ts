export type ZmlConditionOperator = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "contains" | "exists";

export type ZmlConditionSource = "user_input" | "bill_scan" | "external_api" | "calculation";

export interface ZmlCondition {
  field: string;
  operator: ZmlConditionOperator;
  value: unknown;
  source?: ZmlConditionSource;
}

export interface ZmlPredicate {
  operator: "AND" | "OR" | "NOT";
  conditions: Array<ZmlCondition | ZmlPredicate>;
}

export type ZmlActionKind = "letter" | "form" | "calculation" | "claim" | "appeal";

export interface ZmlAction {
  kind: ZmlActionKind;
  template_ref?: string;
  auto_eligible?: boolean;
  requires_human_gate?: boolean;
  output_format?: "pdf" | "email" | "json" | "webhook";
  internal_tool?: string;
}

export interface ZmlSource {
  type: "statute" | "regulation" | "contract" | "case_law" | "guideline";
  reference: string;
  url?: string;
  effective_date?: string;
  authority?: string;
}

export interface ZmlFinancial {
  unit: string;
  estimate?: {
    min_minor?: number;
    max_minor?: number;
    typical_minor?: number;
    basis?: string;
  };
  success_fee_basis?: "saving_amount" | "fixed" | "hourly";
}

export interface ZmlMetadata {
  maintainer?: string;
  last_verified?: string;
  confidence?: "high" | "medium" | "low";
  replaces?: string[];
  sunset_date?: string;
  evaluation_engine?: string;
}

export type ZmlCategory =
  | "telecom"
  | "energy"
  | "finance"
  | "transport"
  | "insurance"
  | "tax"
  | "housing"
  | "employment"
  | "consumer_protection"
  | "health"
  | "education";

export interface ZmlRight {
  zml_version: "1.0.0";
  id: string;
  version?: string;
  display_name: Record<string, string> & { en: string };
  market: string;
  category: ZmlCategory;
  predicate: ZmlPredicate;
  action: ZmlAction;
  source: ZmlSource;
  financial?: ZmlFinancial;
  metadata?: ZmlMetadata;
}

export interface ZmlCatalogEntry {
  id: string;
  display_name: Record<string, string>;
  category: ZmlCategory;
  market: string;
  predicate_summary: string;
  auto_eligible: boolean;
  financial?: ZmlFinancial;
  _links: {
    self: string;
    full: string;
    evaluate: string;
  };
}

export interface ZmlCatalogResponse {
  zml_version: string;
  api_version: string;
  market: string;
  total: number;
  rights: ZmlCatalogEntry[];
  _links?: { next?: string };
}
