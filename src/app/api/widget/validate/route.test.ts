import { describe, it, expect } from "vitest";
import { registerWidgetKey } from "@/lib/widget/keys";
import { GET } from "./route";

describe("GET /api/widget/validate", () => {
  it("returns 403 for missing key", async () => {
    const res = await GET(
      new Request("http://localhost/api/widget/validate", {
        headers: { Origin: "https://partner.example.com" },
      }),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("reflects origin when key matches domain", async () => {
    const key = registerWidgetKey("partner.example.com");
    const res = await GET(
      new Request("http://localhost/api/widget/validate", {
        headers: {
          Origin: "https://app.partner.example.com",
          "X-Zakai-Widget-Key": key,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://app.partner.example.com",
    );
  });
});
