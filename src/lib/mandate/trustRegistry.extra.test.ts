import { describe, expect, it, afterEach } from "vitest";
import {
  ISSUERS,
  countActiveNetworkIssuers,
  decideTrust,
  listRegisteredIssuers,
  validateIssuer,
} from "./trustRegistry";

describe("listRegisteredIssuers", () => {
  const prev = process.env.ZAKAI_EXTRA_ISSUERS_JSON;

  afterEach(() => {
    if (prev === undefined) delete process.env.ZAKAI_EXTRA_ISSUERS_JSON;
    else process.env.ZAKAI_EXTRA_ISSUERS_JSON = prev;
  });

  it("includes core issuers by default", () => {
    expect(listRegisteredIssuers().length).toBe(ISSUERS.length);
  });

  it("merges valid extra issuers from env", () => {
    const extra = {
      iss: "https://partner-issuer.example",
      name: "Partner Issuer",
      jwksUri: "https://partner-issuer.example/.well-known/jwks.json",
      statusListUri: "https://partner-issuer.example/api/revocations",
      allowedScopes: ["read:bills", "dispute:charge"],
      status: "active" as const,
      admittedAt: "2026-08-01",
    };
    expect(validateIssuer(extra, ISSUERS)).toEqual([]);
    process.env.ZAKAI_EXTRA_ISSUERS_JSON = JSON.stringify([extra]);
    const merged = listRegisteredIssuers();
    expect(merged.some((i) => i.iss === extra.iss)).toBe(true);
    expect(countActiveNetworkIssuers()).toBe(ISSUERS.length + 1);
  });

  it("lists sandbox extras without counting them for G5 / decideTrust", () => {
    const sandbox = {
      iss: "https://sandbox.issuer.example",
      name: "Sandbox",
      jwksUri: "https://sandbox.issuer.example/.well-known/jwks.json",
      statusListUri: "https://sandbox.issuer.example/api/revocations",
      allowedScopes: ["read:bills"],
      status: "sandbox" as const,
      admittedAt: "2026-08-03",
    };
    process.env.ZAKAI_EXTRA_ISSUERS_JSON = JSON.stringify([sandbox]);
    expect(listRegisteredIssuers().some((i) => i.iss === sandbox.iss)).toBe(true);
    expect(countActiveNetworkIssuers()).toBe(ISSUERS.filter((i) => i.status === "active").length);
    expect(decideTrust(sandbox.iss, ["read:bills"]).trusted).toBe(false);
  });
});
