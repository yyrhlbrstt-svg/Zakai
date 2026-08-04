import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Live revoke is revokeAuthority in authorityControl.ts (heal + ownership).
 * A second export here would silently drift — keep a single choke-point.
 */
describe("authorization revoke surface", () => {
  it("does not define a dead revokeAuthorization dual-path", () => {
    const src = readFileSync(new URL("./authorization.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/export async function revokeAuthorization/);
  });
});
