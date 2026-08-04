import { describe, it, expect } from "vitest";
import { validateWidgetKey, registerWidgetKey } from "@/lib/widget/keys";

describe("widget keys", () => {
  it("validates registered key against domain", async () => {
    const key = await registerWidgetKey("example.com");
    expect(await validateWidgetKey(key, "https://app.example.com")).toBe(true);
    expect(await validateWidgetKey(key, "https://evil.com")).toBe(false);
  });
});
