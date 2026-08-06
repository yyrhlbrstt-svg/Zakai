import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

/**
 * Every agent CTA must say what it is waiting for.
 *
 * Twenty-one components gate "open a case with the agent" behind a compound
 * predicate — several fields ANDed together, sometimes with a threshold no
 * user could infer from the outside (`fault.trim().length >= 3`,
 * `monthlyAgorot >= 100`). Satisfy all but one and the button is inert: no
 * error, no highlight, no clue which field is at fault. From the user's side
 * that is indistinguishable from a broken product, and it is exactly what
 * real people reported before this was fixed across the board.
 *
 * The fix is only durable if the twenty-second vertical cannot ship without
 * it, so this fails the build rather than trusting anyone to remember.
 */
const DIR = "src/components";

function agentComponents(): string[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".tsx"))
    .filter((f) => readFileSync(`${DIR}/${f}`, "utf8").includes("sendWithAgent"));
}

describe("agent CTAs explain what is missing", () => {
  it("finds the agent components at all (guards against a silent no-op)", () => {
    // A pattern rename would otherwise leave this suite passing vacuously
    // while checking nothing — the failure mode these ratchets exist to avoid.
    expect(agentComponents().length).toBeGreaterThan(10);
  });

  it("every component with an agent CTA renders MissingFields", () => {
    const offenders = agentComponents().filter(
      (f) => !readFileSync(`${DIR}/${f}`, "utf8").includes("MissingFields"),
    );
    expect(
      offenders,
      `these open a Case behind a compound gate but never say which field is ` +
        `missing, so the button just does nothing: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});
