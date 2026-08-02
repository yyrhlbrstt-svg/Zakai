import { describe, it, expect } from "vitest";
import { validateWidgetKey, registerWidgetKey } from "@/lib/widget/keys";

describe("widget keys", () => {
  it("validates registered in-memory key against domain", () => {
    const key = registerWidgetKey("example.com");
    expect(validateWidgetKey(key, "https://app.example.com")).toBe(true);
    expect(validateWidgetKey(key, "https://evil.com")).toBe(false);
  });
});
