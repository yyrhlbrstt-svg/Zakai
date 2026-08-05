import type { AgentNote, PerceptionSignals } from "../types";
import { evaluateRights, type RightsProfile } from "@/lib/rights";

function profileFromSignals(s: PerceptionSignals): RightsProfile {
  return {
    ageGroup: s.ageBand ?? "25_44",
    employment: "employee",
    children: s.children ?? 0,
    childrenUnder6: 0,
    renting: false,
    lowIncome: false,
    newImmigrant: false,
    dischargedSoldier: false,
    reservist: false,
    disability: false,
  };
}

const COUNTRY_MAP: Record<string, "IL" | "UK" | "US" | "DE" | "FR" | "CA" | "AU"> = {
  IL: "IL",
  GB: "UK",
  UK: "UK",
  US: "US",
  DE: "DE",
  FR: "FR",
  CA: "CA",
  AU: "AU",
};

export function runLawAgent(ctx: PerceptionSignals): AgentNote {
  const country = COUNTRY_MAP[ctx.market] ?? "IL";
  const profile = profileFromSignals(ctx);
  const result = evaluateRights(profile, country);
  const top = result.matches.slice(0, 3).map((e) => e.id);
  return {
    agent: "law",
    summary:
      top.length > 0
        ? `Pack matched ${result.matches.length} entitlements; top: ${top.join(", ")}`
        : "No pack matches from current profile signals — refine age/employment/children.",
    confidence: top.length > 0 ? "medium" : "low",
    data: { eligible_count: result.matches.length, sample_ids: top },
  };
}
