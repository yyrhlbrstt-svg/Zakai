import { describe, expect, it } from "vitest";
import { FEATURED_TOOLS, TOOL_CATALOG, toolsInCategory } from "./toolsCatalog";

describe("toolsCatalog", () => {
  it("keeps header dropdown small and loop-focused", () => {
    expect(FEATURED_TOOLS.length).toBeLessThanOrEqual(12);
    expect(FEATURED_TOOLS.length).toBeGreaterThanOrEqual(8);
    expect(FEATURED_TOOLS.some((t) => t.href === "/money")).toBe(true);
    // Developer / network doors stay in the catalog, not the header.
    expect(FEATURED_TOOLS.some((t) => t.href === "/network-proof")).toBe(false);
    expect(FEATURED_TOOLS.some((t) => t.href === "/integrations")).toBe(false);
    expect(FEATURED_TOOLS.some((t) => t.href === "/join-network")).toBe(false);
  });

  it("includes network-proof for inbound institutions", () => {
    expect(TOOL_CATALOG.some((t) => t.href === "/network-proof")).toBe(true);
    expect(TOOL_CATALOG.some((t) => t.href === "/global")).toBe(true);
    expect(toolsInCategory("developers").some((t) => t.href === "/integrations")).toBe(true);
    expect(toolsInCategory("developers").some((t) => t.href === "/institutions/leader")).toBe(true);
  });
});
