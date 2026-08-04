import { describe, expect, it } from "vitest";
import { buildMailtoHref } from "./mailto";

describe("buildMailtoHref", () => {
  it("returns empty for invalid to", () => {
    expect(buildMailtoHref("", "s", "b")).toBe("");
    expect(buildMailtoHref("not-an-email", "s", "b")).toBe("");
  });

  it("encodes subject and body", () => {
    const href = buildMailtoHref("support@example.com", "Cancel now", "Line 1\nLine 2");
    expect(href.startsWith("mailto:support@example.com?")).toBe(true);
    expect(href).toContain("subject=Cancel%20now");
    expect(href).toContain("body=Line%201%0ALine%202");
  });
});
