import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const ensureMandateTokenForCase = vi.fn();
const loadSigningKeyFromEnv = vi.fn();
const mandateEmailAttachment = vi.fn(() => ({
  filename: "mandate.html",
  content: "<html/>",
  contentType: "text/html",
}));
const inboundReceiveEmailAttachment = vi.fn(() => ({
  filename: "inbound.json",
  content: "{}",
  contentType: "application/json",
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    case: { findUnique: (...args: unknown[]) => findUnique(...args) },
  },
}));

vi.mock("@/lib/services/authorization", () => ({
  ensureMandateTokenForCase: (...args: unknown[]) => ensureMandateTokenForCase(...args),
}));

vi.mock("@/lib/mandate/mandate", () => ({
  loadSigningKeyFromEnv: () => loadSigningKeyFromEnv(),
  MandateKeyUnavailableError: class MandateKeyUnavailableError extends Error {},
}));

vi.mock("@/lib/mandate/document", () => ({
  mandateEmailAttachment: () => mandateEmailAttachment(),
}));

vi.mock("@/lib/protocol/inboundPayload", () => ({
  buildInboundReceivePayload: () => ({}),
  inboundReceiveEmailAttachment: () => inboundReceiveEmailAttachment(),
}));

vi.mock("@/lib/phone", () => ({ maskPhone: (p: string) => p }));
vi.mock("@/lib/localePath", () => ({ localeForCountry: () => "he" }));

import { MandateKeyUnavailableError } from "@/lib/mandate/mandate";
import { rebuildMandateAttachmentsForCase } from "./outreachAttachments";

describe("rebuildMandateAttachmentsForCase", () => {
  beforeEach(() => {
    findUnique.mockReset();
    ensureMandateTokenForCase.mockReset();
    loadSigningKeyFromEnv.mockReset();
    findUnique.mockResolvedValue({
      id: "c1",
      vertical: "telecom",
      strategy: null,
      authorization: {
        status: "ACTIVE",
        code: "ZK-A",
        principalName: "Ada",
        principalPhone: "050",
        provider: "partner",
        scope: "scope",
        issuedAt: new Date(),
      },
      user: { country: "IL" },
    });
  });

  it("returns HTML + inbound JSON when machine Mandate is available", async () => {
    ensureMandateTokenForCase.mockResolvedValue({ jti: "jti-1", jws: "a.b.c" });
    const atts = await rebuildMandateAttachmentsForCase("c1");
    expect(atts).toHaveLength(2);
    expect(atts.map((a) => a.filename)).toEqual(["mandate.html", "inbound.json"]);
  });

  it("fails closed (empty) when keys are live but Mandate token is missing", async () => {
    ensureMandateTokenForCase.mockResolvedValue(undefined);
    loadSigningKeyFromEnv.mockReturnValue({ kid: "k", privateJwk: {} });
    const atts = await rebuildMandateAttachmentsForCase("c1");
    expect(atts).toEqual([]);
  });

  it("allows HTML-only when signing keys are unavailable", async () => {
    ensureMandateTokenForCase.mockResolvedValue(undefined);
    loadSigningKeyFromEnv.mockImplementation(() => {
      throw new MandateKeyUnavailableError("missing");
    });
    const atts = await rebuildMandateAttachmentsForCase("c1");
    expect(atts).toHaveLength(1);
    expect(atts[0]?.filename).toBe("mandate.html");
  });
});
