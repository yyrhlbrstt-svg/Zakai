/**
 * The jurisdiction-agnostic rights engine.
 *
 * This file contains no knowledge of any country, and that is the whole point.
 * Everything Israel-specific lives in `packs/il.ts`; everything Britain-specific
 * lives in `packs/gb.ts`. The engine below will not need to change when the
 * hundredth pack lands.
 *
 * It is a total function over data: same profile plus same pack version always
 * yields the same matches. That determinism is not fastidiousness — it is what
 * makes an outcome ledger meaningful. If eligibility could drift, "this claim
 * succeeded 73% of the time" would not be attributable to anything.
 */

import type {
  EvaluationResult,
  JurisdictionPack,
  Predicate,
  RightCategory,
  RightMatch,
  UniversalProfile,
} from "./types";

/**
 * Evaluate a predicate against a profile.
 *
 * Missing optional data never matches. A right is only surfaced when the facts
 * positively support it — an unanswered question must not be read as a "yes",
 * because a false positive here means telling someone money is owed to them
 * when it is not. That failure costs more trust than a missed right costs
 * money.
 */
export function evaluatePredicate(p: Predicate, profile: UniversalProfile): boolean {
  switch (p.kind) {
    case "always":
      return true;
    case "never":
      return false;
    case "all":
      return p.of.every((child) => evaluatePredicate(child, profile));
    case "any":
      return p.of.some((child) => evaluatePredicate(child, profile));
    case "not":
      return !evaluatePredicate(p.of, profile);
    case "num": {
      const value = profile[p.field];
      if (typeof value !== "number" || Number.isNaN(value)) return false;
      if (p.gte !== undefined && value < p.gte) return false;
      if (p.lte !== undefined && value > p.lte) return false;
      return true;
    }
    case "bool":
      return profile[p.field] === p.is;
    case "enum":
      return p.in.includes(profile[p.field]);
    case "extra":
      return profile.extra[p.key] === p.equals;
    case "extraBool":
      return profile.extra[p.key] === p.is;
  }
}

/** Run a whole jurisdiction pack against a profile. */
export function evaluatePack(
  pack: JurisdictionPack,
  profile: UniversalProfile,
): EvaluationResult {
  const matches: RightMatch[] = [];
  const byCategory = new Map<RightCategory, RightMatch[]>();
  let quantifiedYearlyMinor = 0;

  for (const right of pack.rights) {
    if (!evaluatePredicate(right.when, profile)) continue;
    const match: RightMatch = { key: `${pack.market}:${right.id}`, market: pack.market, right };
    matches.push(match);
    quantifiedYearlyMinor += right.yearlyMinor ?? 0;
    const bucket = byCategory.get(right.category);
    if (bucket) bucket.push(match);
    else byCategory.set(right.category, [match]);
  }

  return {
    market: pack.market,
    currency: pack.currency,
    minorUnits: pack.minorUnits,
    matches,
    quantifiedYearlyMinor,
    byCategory,
  };
}

/**
 * Resolve a pack action into the finished document, in the pack's `docLocale`.
 *
 * The placeholders are the identity and case fields the app already collects.
 * Anything the caller did not supply is left as a visible blank rather than
 * silently dropped — a letter that quietly omits an account number reads as
 * complete and gets rejected; a visible `____` gets filled in.
 */
/**
 * "Legal basis:" in each pack's own document language — keyed by the base
 * language of `docLocale` (the region suffix doesn't change the label), not
 * one entry per pack. Falls back to English for any language not yet listed
 * here rather than silently omitting the label.
 */
const LEGAL_BASIS_LABEL: Record<string, string> = {
  he: "בסיס משפטי",
  en: "Legal basis",
  es: "Base legal",
  fr: "Base légale",
  it: "Base giuridica",
  de: "Rechtsgrundlage",
  nl: "Wettelijke grondslag",
  pl: "Podstawa prawna",
  sv: "Rättslig grund",
  ja: "法的根拠",
  pt: "Base legal",
};

function legalBasisLabel(docLocale: string): string {
  const base = docLocale.split("-")[0]?.toLowerCase() ?? "en";
  return LEGAL_BASIS_LABEL[base] ?? LEGAL_BASIS_LABEL.en;
}

export function renderDocument(
  pack: JurisdictionPack,
  rightId: string,
  values: Record<string, string | undefined>,
): { subject: string; body: string } | null {
  const right = pack.rights.find((r) => r.id === rightId);
  if (!right?.action.subject || !right.action.body) return null;

  const recipientBlock = right.action.recipient
    ? (pack.recipients[right.action.recipient] ?? "")
    : "";

  const fill = (template: string) =>
    template.replace(/\{(\w+)\}/g, (_, key: string) => {
      const value = values[key];
      return value && value.trim() ? value.trim() : "____";
    });

  // The citation was already real, verified data (`right.source`) sitting
  // unused — it never reached the actual letter or the reader. Appending it
  // both strengthens the letter itself (a cited claim is harder to dismiss)
  // and makes "we never invent the legal basis" a visible fact in every
  // document produced, not just an internal property of the data.
  const citation = right.source.trim() ? `${legalBasisLabel(pack.docLocale)}: ${right.source.trim()}` : "";

  const parts = [fill(recipientBlock), fill(right.action.body), citation].filter(Boolean);
  return { subject: fill(right.action.subject), body: parts.join("\n\n") };
}

/**
 * Structural validation of a pack. Run in tests and — once packs are
 * contributed from outside — at ingest.
 *
 * The external-URL check is the important one. "Everything happens inside the
 * app" is only a property of the product if it is mechanically enforced; left
 * as a convention it decays back into a list of links within two contributors.
 */
export function validatePack(pack: JurisdictionPack): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  if (!/^[A-Z]{2}$/.test(pack.market)) problems.push(`market must be ISO alpha-2, got "${pack.market}"`);
  if (pack.minorUnits < 1) problems.push("minorUnits must be at least 1");
  if (pack.rights.length === 0) problems.push("pack has no rights");

  for (const right of pack.rights) {
    const at = `${pack.market}:${right.id}`;
    if (seen.has(right.id)) problems.push(`${at}: duplicate id`);
    seen.add(right.id);

    if (!right.source.trim()) problems.push(`${at}: missing statutory source`);

    const { kind, tool, recipient, subject, body } = right.action;
    if (kind === "tool") {
      if (!tool) problems.push(`${at}: tool action without a route`);
      else if (!tool.startsWith("/") || tool.startsWith("//")) {
        problems.push(`${at}: tool route must be an in-app path, got "${tool}"`);
      }
    }
    if (kind === "letter") {
      if (!subject || !body) problems.push(`${at}: letter action without subject/body`);
      if (recipient && !pack.recipients[recipient]) {
        problems.push(`${at}: unknown recipient "${recipient}"`);
      }
    }
    for (const text of [subject, body, tool]) {
      if (text && /https?:\/\//i.test(text)) {
        problems.push(`${at}: contains an external link — fulfilment must stay in-app`);
      }
    }
  }

  return problems;
}
