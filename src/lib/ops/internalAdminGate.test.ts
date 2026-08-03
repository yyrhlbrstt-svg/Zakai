import { describe, expect, it, afterEach } from "vitest";
import { isInternalOpsRequest } from "./internalAdminGate";

describe("isInternalOpsRequest", () => {
  const prev = process.env.ZAKAI_ADMIN_TOKEN;

  afterEach(() => {
    if (prev === undefined) delete process.env.ZAKAI_ADMIN_TOKEN;
    else process.env.ZAKAI_ADMIN_TOKEN = prev;
  });

  it("rejects without token configured", () => {
    delete process.env.ZAKAI_ADMIN_TOKEN;
    const req = new Request("https://x.test/api/health?internal=1", {
      headers: { "x-zakai-admin-token": "secret" },
    });
    expect(isInternalOpsRequest(req)).toBe(false);
  });

  it("accepts matching admin header", () => {
    process.env.ZAKAI_ADMIN_TOKEN = "secret";
    const req = new Request("https://x.test/api/health?internal=1", {
      headers: { "x-zakai-admin-token": "secret" },
    });
    expect(isInternalOpsRequest(req)).toBe(true);
  });
});
