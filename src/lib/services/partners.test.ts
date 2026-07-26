import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import {
  hashApiKey,
  authenticateApiKey,
  hasPermission,
  partnerAnalyze,
  partnerClaim,
  partnerCaseStatus,
  PartnerError,
} from "./partners";

let partnerId: string;
const rawKey = `zakai_test_${Date.now()}`;
let userId: string;

beforeAll(async () => {
  const partner = await prisma.apiKey.create({
    data: {
      name: "Test Partner",
      keyHash: hashApiKey(rawKey),
      permissions: "analyze,claim",
      rateLimit: 1000,
    },
  });
  partnerId = partner.id;

  const user = await prisma.user.create({
    data: {
      email: `partner-user-${Date.now()}@zakai.example`,
      passwordHash: await hashPassword("testpass123"),
      name: "Partner User",
      phone: "+972501234567",
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.partnerCaseLink.deleteMany({ where: { partnerId } });
  await prisma.case.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.apiKey.delete({ where: { id: partnerId } });
});

describe("partner service", () => {
  it("authenticates a valid API key", async () => {
    const record = await authenticateApiKey(rawKey);
    expect(record).not.toBeNull();
    expect(record?.name).toBe("Test Partner");
  });

  it("rejects an invalid API key", async () => {
    const record = await authenticateApiKey("invalid-key");
    expect(record).toBeNull();
  });

  it("checks permissions", () => {
    expect(hasPermission({ permissions: "analyze,claim" }, "claim")).toBe(true);
    expect(hasPermission({ permissions: "analyze" }, "claim")).toBe(false);
  });

  it("analyzes a bill without creating a case", async () => {
    const result = await partnerAnalyze({
      apiKeyId: partnerId,
      provider: "cellcom",
      amountShekels: 100,
      customerName: "Test",
      locale: "he",
    });
    expect(result.provider).toBe("cellcom");
    expect(result.targetShekels).toBeLessThan(100);
    expect(result.draftMessage).toContain("זכאי");
  });

  it("claims a case on behalf of a user", async () => {
    const result = await partnerClaim({
      apiKeyId: partnerId,
      userId,
      partnerRef: "partner-ref-1",
      provider: "partner",
      amountShekels: 150,
      customerName: "Partner User",
      locale: "he",
    });
    expect(result.caseId).toBeDefined();
    expect(result.partnerRef).toBe("partner-ref-1");
    expect(result.status).toBe("ANALYZED");

    const status = await partnerCaseStatus(partnerId, result.caseId);
    expect(status.provider).toBe("partner");
    expect(status.partnerRef).toBe("partner-ref-1");
  });

  it("throws on unknown case status lookup", async () => {
    await expect(partnerCaseStatus(partnerId, "non-existent-case")).rejects.toThrow(PartnerError);
  });
});
