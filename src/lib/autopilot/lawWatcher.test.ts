import { describe, expect, it } from "vitest";
import { collectPackHttpSources, hashContent, similarityRatio } from "./lawWatcher";

describe("law watcher helpers", () => {
  it("collects HTTP sources from packs when present", () => {
    const sources = collectPackHttpSources();
    expect(Array.isArray(sources)).toBe(true);
  });

  it("hashes consistently", () => {
    expect(hashContent("a  b")).toBe(hashContent("a b"));
  });

  it("similarity detects major change", () => {
    expect(similarityRatio("hello world", "completely different")).toBeLessThan(0.5);
  });
});
