import type { JurisdictionPack, PackAction, RightDef } from "@/lib/global/types";
import { packRightUILabel } from "@/lib/global/packLabels";
import { FOUNDER_EMAIL } from "@/lib/contact";
import { ZML_VERSION } from "./constants";
import { packCategoryToZml } from "./category-map";
import { predicateToZml, summarizePredicate } from "./predicate-map";
import type { ZmlAction, ZmlRight, ZmlSource } from "./types";

export interface PackToZmlContext {
  origin: string;
  maintainer?: string;
}

function globalRightId(market: string, rightId: string): string {
  const prefix = `${market.toLowerCase()}_`;
  return rightId.startsWith(prefix) ? rightId : `${prefix}${rightId}`;
}

function inferSourceType(reference: string): ZmlSource["type"] {
  const r = reference.toLowerCase();
  if (r.includes("תקנה") || r.includes("regulation") || r.includes("directive")) return "regulation";
  if (r.includes("חוק") || r.includes("act") || r.includes("statute")) return "statute";
  return "guideline";
}

function actionToZml(action: PackAction, origin: string, zmlId: string): ZmlAction {
  if (action.kind === "tool" && action.tool) {
    return {
      kind: "calculation",
      internal_tool: action.tool,
      auto_eligible: false,
      requires_human_gate: true,
      output_format: "json",
    };
  }
  if (action.kind === "agent") {
    return {
      kind: "claim",
      template_ref: `${origin}/api/rights/catalog/${zmlId}`,
      auto_eligible: false,
      requires_human_gate: true,
      output_format: "email",
    };
  }
  return {
    kind: "letter",
    template_ref: `${origin}/api/rights/catalog/${zmlId}`,
    auto_eligible: false,
    requires_human_gate: true,
    output_format: "email",
  };
}

export function rightDefToZml(
  pack: JurisdictionPack,
  right: RightDef,
  ctx: PackToZmlContext,
): ZmlRight {
  const id = globalRightId(pack.market, right.id);
  const enLabel = packRightUILabel(pack.market, right.id, "en") ?? right.id.replace(/_/g, " ");
  const heLabel = packRightUILabel(pack.market, right.id, "he") ?? enLabel;

  const financial =
    right.yearlyMinor || right.oneTimeMinor
      ? {
          unit: pack.currency,
          estimate: {
            ...(right.yearlyMinor
              ? { typical_minor: right.yearlyMinor, basis: "Conservative yearly estimate (minor units)" }
              : {}),
            ...(right.oneTimeMinor && !right.yearlyMinor
              ? { typical_minor: right.oneTimeMinor, basis: "Conservative one-time estimate (minor units)" }
              : {}),
          },
          success_fee_basis: "saving_amount" as const,
        }
      : undefined;

  return {
    zml_version: ZML_VERSION,
    id,
    version: pack.reviewed,
    display_name: { en: enLabel, he: heLabel },
    market: pack.market,
    category: packCategoryToZml(right.category),
    predicate: predicateToZml(right.when),
    action: actionToZml(right.action, ctx.origin, id),
    source: {
      type: inferSourceType(right.source),
      reference: right.source,
    },
    financial,
    metadata: {
      maintainer: ctx.maintainer ?? process.env.ZML_MAINTAINER_EMAIL?.trim() ?? FOUNDER_EMAIL,
      last_verified: pack.reviewed,
      confidence: "high",
      evaluation_engine: "zakai_predicate_v1",
    },
  };
}

export function packToZmlRights(pack: JurisdictionPack, ctx: PackToZmlContext): ZmlRight[] {
  return pack.rights.map((r) => rightDefToZml(pack, r, ctx));
}

export function predicateSummaryForRight(right: RightDef): string {
  return summarizePredicate(right.when);
}
