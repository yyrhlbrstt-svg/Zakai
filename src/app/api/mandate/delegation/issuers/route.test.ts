import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    delegatedIssuer: { findMany: vi.fn(), create: vi.fn() },
    delegationApplication: { update: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";

function postReq(body: unknown, authHeader?: string) {
  return new Request("http://localhost/api/mandate/delegation/issuers", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {},
    body: JSON.stringify(body),
  });
}

describe("GET /api/mandate/delegation/issuers", () => {
  beforeEach(() => {
    vi.mocked(prisma.delegatedIssuer.findMany).mockReset();
  });

  it("returns slugs without key material", async () => {
    vi.mocked(prisma.delegatedIssuer.findMany).mockResolvedValue([
      {
        id: "c1",
        slug: "pilot-agent",
        name: "Pilot Agent",
        keyHash: "hash",
        status: "active",
        allowedScopes: ["read:bills"],
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        lastUsedAt: null,
      },
    ]);

    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.issuers[0].slug).toBe("pilot-agent");
    expect(JSON.stringify(body)).not.toContain("keyHash");
  });
});

describe("POST /api/mandate/delegation/issuers (admit)", () => {
  beforeEach(() => {
    vi.mocked(prisma.delegatedIssuer.create).mockReset();
    vi.mocked(prisma.delegationApplication.update).mockReset();
    vi.stubEnv("ZAKAI_ADMIN_TOKEN", "test-admin-token");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires the admin bearer token", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      postReq({ slug: "agent.example", name: "Agent", allowedScopes: ["read:bills"] }, "Bearer wrong"),
    );
    expect(res.status).toBe(401);
    expect(prisma.delegatedIssuer.create).not.toHaveBeenCalled();
  });

  it("rejects a forbidden scope without ever hitting the database", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      postReq(
        { slug: "agent.example", name: "Agent", allowedScopes: ["payment:initiate"] },
        "Bearer test-admin-token",
      ),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("scope_forbidden");
    expect(prisma.delegatedIssuer.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown scope", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      postReq(
        { slug: "agent.example", name: "Agent", allowedScopes: ["not:a:real:scope"] },
        "Bearer test-admin-token",
      ),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("scope_unknown");
  });

  it(
    "admits a real issuer: creates the row with a correctly-hashed key, " +
      "returns the raw key exactly once, and marks the source application approved",
    async () => {
      vi.mocked(prisma.delegatedIssuer.create).mockResolvedValue({} as never);
      vi.mocked(prisma.delegationApplication.update).mockResolvedValue({} as never);
      const { POST } = await import("./route");
      const { hashIssuerKey } = await import("@/lib/mandate/delegation");

      const res = await POST(
        postReq(
          {
            applicationId: "app_1",
            slug: "agent.example",
            name: "Example Agent",
            allowedScopes: ["read:bills", "negotiate:tariff"],
          },
          "Bearer test-admin-token",
        ),
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.api_key).toMatch(/^zkid_/);
      expect(body.slug).toBe("agent.example");

      expect(prisma.delegatedIssuer.create).toHaveBeenCalledWith({
        data: {
          slug: "agent.example",
          name: "Example Agent",
          keyHash: hashIssuerKey(body.api_key),
          allowedScopes: ["read:bills", "negotiate:tariff"],
          status: "active",
        },
      });
      expect(prisma.delegationApplication.update).toHaveBeenCalledWith({
        where: { id: "app_1" },
        data: { status: "approved" },
      });
    },
  );

  it("returns 409 on a duplicate slug instead of a raw DB error", async () => {
    vi.mocked(prisma.delegatedIssuer.create).mockRejectedValue(new Error("unique constraint"));
    const { POST } = await import("./route");
    const res = await POST(
      postReq(
        { slug: "already-taken", name: "Agent", allowedScopes: ["read:bills"] },
        "Bearer test-admin-token",
      ),
    );
    expect(res.status).toBe(409);
  });
});
