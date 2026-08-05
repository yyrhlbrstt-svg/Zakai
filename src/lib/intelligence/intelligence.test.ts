import { describe, expect, it } from "vitest";
import { runMathAgent } from "./agents/math";
import { runTimingAgent } from "./agents/timing";
import { runLawAgent } from "./agents/law";

describe("intelligence agents", () => {
  it("math agent flags tenure", () => {
    const note = runMathAgent({ market: "IL", monthsOnPlan: 18 });
    expect(note.agent).toBe("math");
    expect(note.summary).toContain("12+");
  });

  it("law agent returns matches for IL profile", () => {
    const note = runLawAgent({ market: "IL", ageBand: "25_44", children: 0 });
    expect(note.data?.eligible_count).toBeGreaterThan(0);
  });

  it("timing agent returns advice", () => {
    const note = runTimingAgent(new Date("2026-08-05T07:00:00Z"));
    expect(note.agent).toBe("timing");
  });
});
