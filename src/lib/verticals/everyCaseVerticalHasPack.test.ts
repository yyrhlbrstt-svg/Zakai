import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RULE_PACKS } from "./packs";

/**
 * A vertical that opens real cases must have a rule pack.
 *
 * `recordSaving` reads `pack?.feeBasis ?? "monthly"`, and
 * `documentedRecoveryMinor` multiplies a monthly saving by twelve before it
 * reaches `StrategyOutcome`. A vertical with no pack therefore records every
 * one-time recovery at twelve times its real value — a ₪2,000 settlement
 * enters the graph as ₪24,000.
 *
 * The success fee usually comes out right anyway, because these cases open
 * with a target of zero and settle against the full amount, which is exactly
 * why nothing noticed. The corruption lands only in the de-identified record
 * — the one place it compounds silently instead of showing up on somebody's
 * invoice, and the one we now tell other agents to trust.
 *
 * Eight verticals were in this state at once: baggage, and then toll-dispute,
 * water-bill, vehicle-license-refund, train-delay, landlord-repairs,
 * vaad-bait and collection-complaint. Adding a route is easy and registering
 * a pack is a separate step, so this will happen again unless it is checked.
 */

const CASES_DIR = join(process.cwd(), "src", "app", "api", "cases");

/**
 * Verticals named by a case route, read from source.
 *
 * The route files are the authority here rather than a hand-kept list: the
 * whole failure is that adding one is a step somebody can complete without
 * touching anything else.
 */
function verticalsOpeningCases(): { vertical: string; file: string }[] {
  const found: { vertical: string; file: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "route.ts") {
        const src = readFileSync(full, "utf8");
        for (const m of src.matchAll(/vertical:\s*"([a-z0-9-]+)"/g)) {
          found.push({ vertical: m[1], file: full.replace(process.cwd() + "/", "") });
        }
      }
    }
  };
  walk(CASES_DIR);
  return found;
}

describe("every vertical that opens a case has a rule pack", () => {
  it("registers a pack for each one", () => {
    const registered = new Set(RULE_PACKS.map((p) => p.key));
    const missing = [
      ...new Set(
        verticalsOpeningCases()
          .filter((v) => !registered.has(v.vertical))
          .map((v) => `${v.vertical}  (${v.file})`),
      ),
    ];

    expect(
      missing,
      missing.length
        ? "These open real cases with no rule pack, so every recovery is recorded at twelve " +
            `times its value in the outcome graph:\n  ${missing.join("\n  ")}`
        : "",
    ).toEqual([]);
  });

  it("reads real routes, so it cannot pass by finding nothing", () => {
    // A path change or a rename would otherwise turn this into a test that
    // checks an empty list and reports success.
    const found = verticalsOpeningCases();
    expect(found.length).toBeGreaterThan(10);
    expect(new Set(found.map((f) => f.vertical)).size).toBeGreaterThan(10);
  });
});
