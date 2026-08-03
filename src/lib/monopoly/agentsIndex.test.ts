import { describe, expect, it } from "vitest";
import { AGENTS_INDEX_SPEC, buildAgentsIndexDocument } from "./agentsIndex";

describe("buildAgentsIndexDocument", () => {
  it("lists required tools with handoff first", () => {
    const doc = buildAgentsIndexDocument("https://zakai.example/");
    expect(doc.spec).toBe(AGENTS_INDEX_SPEC);
    expect(doc.required_tools[0]?.id).toBe("pipe_handoff");
    expect(doc.required_tools.some((t) => t.id === "mandate_ready")).toBe(true);
    expect(doc.manifests.pipe).toContain("zakai-pipe.json");
    expect(doc.manifests.mandate_ready).toContain("/api/mandate/ready");
    expect(doc.doors).toContain("money");
    expect(doc.honesty).toMatch(/Empty volume/i);
  });
});
