import { describe, expect, it, afterEach } from "vitest";
import { isInternalOpsRequest, isAdminEmail, adminEmailList } from "./internalAdminGate";

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

describe("adminEmailList / isAdminEmail", () => {
  const prev = process.env.ADMIN_EMAIL;

  afterEach(() => {
    if (prev === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = prev;
  });

  it("parses a comma-separated list, trimmed and lowercased", () => {
    process.env.ADMIN_EMAIL = " Founder@Zakai.test , second@zakai.test ";
    expect(adminEmailList()).toEqual(["founder@zakai.test", "second@zakai.test"]);
  });

  it("is empty when unset", () => {
    delete process.env.ADMIN_EMAIL;
    expect(adminEmailList()).toEqual([]);
  });

  it("matches case-insensitively", () => {
    process.env.ADMIN_EMAIL = "founder@zakai.test";
    expect(isAdminEmail("Founder@Zakai.test")).toBe(true);
    expect(isAdminEmail("someone-else@zakai.test")).toBe(false);
  });
});
