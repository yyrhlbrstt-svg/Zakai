import { describe, expect, it } from "vitest";
import { gzipSync } from "node:zlib";
import { readStatus, STATUS_LIST_TYPE } from "../src/statusList.js";

describe("statusList client", () => {
  it("reads revoked bits from a packed list", () => {
    const bytes = new Uint8Array(2);
    bytes[0] = 0b0000_0010; // index 1 revoked
    const lst = Buffer.from(gzipSync(Buffer.from(bytes))).toString("base64url");
    expect(readStatus(lst, 0)).toBe(false);
    expect(readStatus(lst, 1)).toBe(true);
    expect(STATUS_LIST_TYPE).toBe("statuslist+jwt");
  });
});
