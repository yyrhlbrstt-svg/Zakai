import { describe, it, expect } from "vitest";
import { rankGeminiModels } from "./ai";

describe("rankGeminiModels", () => {
  it("prefers known-good flash models in order, then other flash models", () => {
    const ranked = rankGeminiModels([
      "gemini-2.0-flash",
      "gemini-2.5-pro",
      "gemini-2.5-flash-lite",
      "gemini-2.5-flash",
      "gemini-3.0-flash",
    ]);
    expect(ranked[0]).toBe("gemini-2.5-flash");
    expect(ranked[1]).toBe("gemini-2.5-flash-lite");
    expect(ranked).toContain("gemini-3.0-flash"); // unknown-but-flash still usable
    expect(ranked).not.toContain("gemini-2.5-pro"); // non-flash excluded (cost)
  });

  it("filters out non-chat flash variants", () => {
    const ranked = rankGeminiModels([
      "gemini-2.5-flash-image",
      "gemini-2.5-flash-preview-tts",
      "gemini-2.5-flash-live",
      "gemini-embedding-001",
      "gemini-2.5-flash",
    ]);
    expect(ranked).toEqual(["gemini-2.5-flash"]);
  });

  it("returns empty for a list with no usable flash model", () => {
    expect(rankGeminiModels(["gemini-2.5-pro", "gemini-embedding-001"])).toEqual([]);
  });
});
