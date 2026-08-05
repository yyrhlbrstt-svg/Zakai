import { describe, expect, it } from "vitest";
import { isConversionHref } from "./DoorTracker";

/**
 * Every href in home.tsx's doorsByKey must count as a conversion — a door
 * missing here is an experiment arm (dormant_first, incident_first,
 * vehicle_check_first, owed_first) that can never accumulate conversions
 * and can never be promoted by the evolve engine, regardless of how well it
 * actually performs.
 */
describe("isConversionHref", () => {
  it.each([
    "/money",
    "/cancel",
    "/what-am-i-owed",
    "/entitlements",
    "/electricity",
    "/incident",
    "/dormant",
    "/vehicle-check",
  ])("counts %s as a conversion", (href) => {
    expect(isConversionHref(href)).toBe(true);
  });

  it("matches locale-prefixed hrefs", () => {
    expect(isConversionHref("/he/dormant")).toBe(true);
    expect(isConversionHref("/en/vehicle-check?ref=abc")).toBe(true);
  });

  it("does not count unrelated navigation as a conversion", () => {
    expect(isConversionHref("/pricing")).toBe(false);
    expect(isConversionHref("/tools")).toBe(false);
    expect(isConversionHref("")).toBe(false);
  });
});
