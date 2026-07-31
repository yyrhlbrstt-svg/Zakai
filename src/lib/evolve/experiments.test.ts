import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { EXPERIMENTS } from "./experiments";

/**
 * "dormant" and "incident" were added to the homepage's door grid with a
 * comment calling them the two strongest reasons to open the app — but no arm
 * of home_door_order ever placed either one first, so the self-improving
 * ranking engine could never discover that, no matter how well they actually
 * converted. A door on the page that no arm ever tests in a winning position
 * is invisible to the experiment regardless of how the engine picks a winner.
 *
 * This reads the homepage source as text (matching openapi.test.ts and
 * discovery.test.ts's convention of catching drift between two files that
 * have to agree) rather than importing the page component, since the page is
 * a server component and the door list lives inline in its JSX.
 */
const homepageSource = readFileSync("src/app/[locale]/page.tsx", "utf8");

function doorKeysOnHomepage(): string[] {
  const hrefs = [...homepageSource.matchAll(/href:\s*"\/([a-z-]+)"/g)].map((m) => m[1]);
  // Mirrors page.tsx's own doorKey() normalisation.
  return hrefs.map((h) => (h === "what-am-i-owed" ? "owed" : h));
}

describe("home_door_order covers every door actually on the homepage", () => {
  const experiment = EXPERIMENTS.find((e) => e.id === "home_door_order");

  it("the experiment exists", () => {
    expect(experiment).toBeDefined();
  });

  it("every door rendered on the homepage appears in at least one arm's payload", () => {
    const doors = doorKeysOnHomepage();
    expect(doors.length).toBeGreaterThan(0);

    const testedKeys = new Set(
      (experiment!.arms as { payload: readonly string[] }[]).flatMap((a) => a.payload),
    );

    for (const door of doors) {
      expect({ door, testedByAnyArm: testedKeys.has(door) }).toEqual({
        door,
        testedByAnyArm: true,
      });
    }
  });
});
