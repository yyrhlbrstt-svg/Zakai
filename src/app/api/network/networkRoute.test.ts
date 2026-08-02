import { describe, expect, it } from "vitest";
import { PROTOCOL_LAWS } from "@/lib/protocol/laws";

describe("GET /api/network shape", () => {
  it("laws are embedded in feed builder", async () => {
    const { buildNetworkFeed } = await import("@/lib/protocol/discovery");
    const feed = await buildNetworkFeed("https://zakai.example");
    expect(feed.spec).toBe("zakai-network");
    expect(feed.laws).toEqual(PROTOCOL_LAWS);
    expect(feed.protocol).toContain("zakai-protocol.json");
  });
});
