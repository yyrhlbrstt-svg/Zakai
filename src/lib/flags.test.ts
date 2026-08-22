import { describe, expect, it, afterEach } from "vitest";
import { FLAGS, allFlags, flagEnabled } from "./flags";

const ENV = FLAGS.durableCaseWorkflow;
afterEach(() => {
  delete process.env[ENV];
});

describe("feature flags", () => {
  it("is off when unset — merging must never turn anything on", () => {
    expect(flagEnabled("durableCaseWorkflow")).toBe(false);
  });

  it("accepts the spellings a human actually types", () => {
    for (const on of ["1", "true", "TRUE", " on ", "yes"]) {
      process.env[ENV] = on;
      expect(flagEnabled("durableCaseWorkflow"), on).toBe(true);
    }
  });

  it("treats anything else as off rather than guessing", () => {
    for (const off of ["", "0", "false", "no", "maybe", "off", "  "]) {
      process.env[ENV] = off;
      expect(flagEnabled("durableCaseWorkflow"), off).toBe(false);
    }
  });

  it("reports every flag with the env var that controls it", () => {
    const all = allFlags();
    expect(all.length).toBe(Object.keys(FLAGS).length);
    for (const f of all) expect(f.env.startsWith("ZAKAI_FLAG_")).toBe(true);
  });

  it("reads at call time so a flip does not wait for a cold start", () => {
    expect(flagEnabled("durableCaseWorkflow")).toBe(false);
    process.env[ENV] = "true";
    expect(flagEnabled("durableCaseWorkflow")).toBe(true);
  });
});
