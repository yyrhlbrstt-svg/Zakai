import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/services/priorityBoosts", () => ({
  getPriorityCatalogBoosts: vi.fn(async () => ({})),
}));

import { rankLeakEntries } from "./leaksRank";

const SAMPLE = [
  { href: "/parking", he: "a", en: "a", subHe: "", subEn: "", rank: 2 },
  { href: "/money", he: "b", en: "b", subHe: "", subEn: "", rank: 3 },
  { href: "/cancel", he: "c", en: "c", subHe: "", subEn: "", rank: 1 },
] as const;

describe("rankLeakEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("puts high-priority catalog doors first", async () => {
    const ranked = await rankLeakEntries([...SAMPLE]);
    expect(ranked[0]?.href).toBe("/money");
  });
});
