import { describe, expect, it } from "vitest";
import { PROTOCOL_PATH, NETWORK_PATH } from "../src/protocol.js";

describe("protocol paths", () => {
  it("uses well-known manifest", () => {
    expect(PROTOCOL_PATH).toBe("/.well-known/zakai-protocol.json");
    expect(NETWORK_PATH).toBe("/api/network");
  });
});
