import { describe, expect, it } from "vitest";
import { FEATURED_TOOLS, TOOL_CATALOG, toolsInCategory } from "./toolsCatalog";

describe("toolsCatalog", () => {
  it("keeps header dropdown small", () => {
    expect(FEATURED_TOOLS.length).toBeLessThanOrEqual(14);
    expect(FEATURED_TOOLS.length).toBeGreaterThanOrEqual(8);
  });

  it("includes network-proof for inbound institutions", () => {
    expect(TOOL_CATALOG.some((t) => t.href === "/network-proof")).toBe(true);
    expect(TOOL_CATALOG.some((t) => t.href === "/global")).toBe(true);
    expect(toolsInCategory("developers").some((t) => t.href === "/integrations")).toBe(true);
    expect(toolsInCategory("developers").some((t) => t.href === "/institutions/leader")).toBe(true);
  });
});
