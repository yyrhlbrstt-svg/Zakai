import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const create = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    registeredIssuerRow: {
      findMany: (...args: unknown[]) => findMany(...args),
      create: (...args: unknown[]) => create(...args),
    },
  },
}));

import { registerFullIssuer, listRegisteredIssuers, ISSUERS } from "./trustRegistry";

const CANDIDATE = {
  iss: "https://second-issuer.example",
  name: "Second Issuer",
  jwksUri: "https://second-issuer.example/.well-known/jwks.json",
  statusListUri: "https://second-issuer.example/api/mandate/revocations",
  allowedScopes: ["read:bills", "dispute:charge"],
  status: "active" as const,
};

describe("registerFullIssuer", () => {
  beforeEach(() => {
    findMany.mockReset();
    create.mockReset();
    findMany.mockResolvedValue([]);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("admits a well-formed candidate: writes a correctly-shaped row and returns it", async () => {
    create.mockResolvedValue({});
    const result = await registerFullIssuer(CANDIDATE);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.issuer.iss).toBe(CANDIDATE.iss);
    expect(create).toHaveBeenCalledWith({
      data: {
        iss: CANDIDATE.iss,
        name: CANDIDATE.name,
        jwksUri: CANDIDATE.jwksUri,
        statusListUri: CANDIDATE.statusListUri,
        allowedScopes: CANDIDATE.allowedScopes,
        status: "active",
        note: "",
      },
    });
  });

  it("refuses a forbidden scope without ever writing a row", async () => {
    const result = await registerFullIssuer({ ...CANDIDATE, allowedScopes: ["payment:initiate"] });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refusal");
    expect(result.problems.some((p) => p.kind === "forbidden_scope")).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a duplicate iss against the core ISSUERS list without writing a row", async () => {
    const result = await registerFullIssuer({ ...CANDIDATE, iss: ISSUERS[0].iss });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refusal");
    expect(result.problems.some((p) => p.kind === "duplicate_iss")).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a duplicate iss against an already-registered DB row", async () => {
    findMany.mockResolvedValue([
      {
        iss: CANDIDATE.iss,
        name: "Already here",
        jwksUri: CANDIDATE.jwksUri,
        statusListUri: CANDIDATE.statusListUri,
        allowedScopes: CANDIDATE.allowedScopes,
        status: "active",
        admittedAt: new Date("2026-08-01"),
        note: "",
      },
    ]);
    const result = await registerFullIssuer(CANDIDATE);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refusal");
    expect(result.problems.some((p) => p.kind === "duplicate_iss")).toBe(true);
  });

  it("refuses plain-HTTP URIs (the exact transit-substitution risk validateIssuer exists to block)", async () => {
    const result = await registerFullIssuer({ ...CANDIDATE, jwksUri: "http://second-issuer.example/jwks" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refusal");
    expect(result.problems.some((p) => p.kind === "insecure_uri" && p.field === "jwksUri")).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it("a freshly admitted issuer is immediately visible to listRegisteredIssuers via the DB row", async () => {
    create.mockResolvedValue({});
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        iss: CANDIDATE.iss,
        name: CANDIDATE.name,
        jwksUri: CANDIDATE.jwksUri,
        statusListUri: CANDIDATE.statusListUri,
        allowedScopes: CANDIDATE.allowedScopes,
        status: "active",
        admittedAt: new Date("2026-08-05"),
        note: "",
      },
    ]);
    await registerFullIssuer(CANDIDATE);
    const all = await listRegisteredIssuers();
    expect(all.some((i) => i.iss === CANDIDATE.iss)).toBe(true);
  });

  it("degrades to an empty DB contribution (not a throw) when the database is unreachable", async () => {
    findMany.mockRejectedValue(new Error("db down"));
    const all = await listRegisteredIssuers();
    expect(all.length).toBe(ISSUERS.length);
  });
});
