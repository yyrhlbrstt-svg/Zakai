/**
 * The Rights Graph's public, machine-readable face — the flywheel's first
 * step made real: any agent may read the graph for free, evaluate a person's
 * facts against it, and get back rights WITH their statutory sources — so it
 * can verify every claim independently instead of trusting us. Acting on a
 * right is where the Mandate begins, and the response says exactly where.
 *
 * Doctrine encoded here, not assumed:
 *  - Only `verified` rights are served. Drafts are counted (honesty about
 *    coverage) but never detailed — draft law reaches no external surface.
 *  - Remedy amounts come from evaluateRemedyMinor: computed or absent,
 *    never invented.
 */

import { evaluateRemedyMinor, rightApplies, type CaseFacts, type Right } from "./schema";
import { RIGHTS, verifiedRights } from "./registry";
import { resolveDirectoryRef } from "./directory";

export const RIGHTS_GRAPH_VERSION = "1";

function publicRight(origin: string, right: Right) {
  return {
    id: right.id,
    jurisdiction: right.jurisdiction,
    domain: right.domain,
    title: right.title,
    statute: right.statute, // includes sourceUrl + lastVerifiedAt — verify us, don't trust us
    trigger_facts: collectTriggerFields(right),
    remedy: {
      kind: right.remedy.kind,
      capMinor: right.remedy.capMinor,
      currency: right.remedy.currency,
    },
    procedure: right.procedure,
    recipient: resolveRecipient(right.procedure.recipientDirectoryRef),
    escalation: right.escalation,
    act: {
      note: "Reading is free. Acting in a person's name requires a verified Mandate.",
      mandate_spec: `${origin}/.well-known/zakai-mandate.json`,
      handoff: `${origin}/api/pipe/handoff`,
    },
  };
}

/**
 * A directoryRef resolved for external readers: "self" tells an agent the
 * demand goes to the person's own counterparty (named at demand-build time);
 * a regulator ref becomes the body's legal name, verified intake channel,
 * and the date a human last confirmed both. Refs are guaranteed to resolve
 * by the registry test, so the null arm is defensive, not expected.
 */
function resolveRecipient(ref: string) {
  const resolved = resolveDirectoryRef(ref);
  if (!resolved) return { ref, kind: "unresolved" as const };
  if (resolved.kind === "self") {
    return {
      ref,
      kind: "counterparty" as const,
      note: "The provider on the person's own case — named when the demand is built.",
    };
  }
  const { entry } = resolved;
  return {
    ref,
    kind: "regulator" as const,
    legalName: entry.legalName,
    demand: entry.demand,
    sourceUrl: entry.sourceUrl,
    lastVerifiedAt: entry.lastVerifiedAt,
  };
}

/** The fact fields a caller must supply for this right's trigger to be decidable. */
export function collectTriggerFields(right: Right): string[] {
  const fields = new Set<string>();
  const walk = (p: Right["trigger"][number]): void => {
    if (p.kind === "fact") fields.add(p.field);
    else if (p.kind === "not") walk(p.of);
    else p.of.forEach(walk);
  };
  right.trigger.forEach(walk);
  return [...fields].sort();
}

/** GET /.well-known/zakai-rights.json — discovery manifest. */
export function buildRightsManifest(origin: string) {
  const verified = verifiedRights();
  return {
    spec: "zakai-rights-graph",
    version: RIGHTS_GRAPH_VERSION,
    thesis:
      "What a person is entitled to, under which law, from whom, worth how much — as data an agent can evaluate, with the statutory source on every entry.",
    counts: {
      verified: verified.length,
      // Drafts exist and are named as a number so coverage is honest,
      // but their content stays out of every external surface.
      draft_pending_verification: RIGHTS.length - verified.length,
    },
    jurisdictions: [...new Set(verified.map((r) => r.jurisdiction))].sort(),
    domains: [...new Set(verified.map((r) => r.domain))].sort(),
    api: {
      list: `${origin}/api/rights-graph`,
      evaluate: `${origin}/api/rights-graph/evaluate`,
      evaluate_method: "POST { facts: { <field>: value, ... } }",
    },
    verification:
      "Every verified right carries statute.sourceUrl and statute.lastVerifiedAt. Draft law is excluded from this surface and from letter generation, enforced in code.",
    related: {
      mandate: `${origin}/.well-known/zakai-mandate.json`,
      pipe: `${origin}/.well-known/zakai-pipe.json`,
      mcp: `${origin}/api/mcp`,
    },
  };
}

/** GET /api/rights-graph — every verified right, in full, with sources. */
export function buildRightsListing(origin: string) {
  return {
    spec: "zakai-rights-graph",
    version: RIGHTS_GRAPH_VERSION,
    rights: verifiedRights().map((r) => publicRight(origin, r)),
  };
}

/**
 * POST /api/rights-graph/evaluate — which verified rights apply to these
 * facts, with the computed remedy where it is computable. A right whose
 * trigger fields are absent simply does not apply (fail closed); the
 * response also names which fields each non-matching right would need, so
 * an agent knows what to ask the person next.
 */
export function evaluateFacts(origin: string, facts: CaseFacts) {
  const applicable: unknown[] = [];
  const notYetDecidable: { id: string; missing_facts: string[] }[] = [];

  for (const right of verifiedRights()) {
    const needed = collectTriggerFields(right);
    const missing = needed.filter((f) => facts[f] === undefined || facts[f] === null);
    if (rightApplies(right, facts)) {
      const remedyMinor = evaluateRemedyMinor(right.remedy, facts);
      applicable.push({
        ...publicRight(origin, right),
        // Computed or absent — never invented (see evaluateRemedyMinor).
        ...(remedyMinor !== null ? { computed_remedy_minor: remedyMinor } : {}),
      });
    } else if (missing.length > 0) {
      notYetDecidable.push({ id: right.id, missing_facts: missing });
    }
  }

  return {
    spec: "zakai-rights-graph",
    version: RIGHTS_GRAPH_VERSION,
    applicable,
    not_yet_decidable: notYetDecidable,
    disclaimer:
      "Machine evaluation of encoded rights against supplied facts — not legal advice, and never a promise of an outcome.",
  };
}
