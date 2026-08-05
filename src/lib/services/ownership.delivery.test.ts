import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const create = vi.fn();
const findUniqueUser = vi.fn();
const findUniqueCase = vi.fn();
const sendSms = vi.fn();
const sendEmail = vi.fn();
const smsConfigured = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    phoneVerification: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      create: (...args: unknown[]) => create(...args),
    },
    user: { findUnique: (...args: unknown[]) => findUniqueUser(...args) },
    case: { findUnique: (...args: unknown[]) => findUniqueCase(...args) },
  },
}));

vi.mock("@/lib/messaging", () => ({
  sendSms: (...args: unknown[]) => sendSms(...args),
  sendEmail: (...args: unknown[]) => sendEmail(...args),
  smsConfigured: () => smsConfigured(),
}));

vi.mock("@/lib/codes", () => ({
  generateNumericCode: () => "123456",
  hashCode: (c: string) => `h:${c}`,
  safeEqualHex: () => true,
}));

vi.mock("jose", () => ({
  SignJWT: class {
    setProtectedHeader() {
      return this;
    }
    setIssuedAt() {
      return this;
    }
    setExpirationTime() {
      return this;
    }
    async sign() {
      return "jwt.token";
    }
  },
}));

import { sendOwnershipCode } from "./ownership";

describe("sendOwnershipCode delivery honesty", () => {
  beforeEach(() => {
    findFirst.mockReset();
    create.mockReset();
    findUniqueUser.mockReset();
    findUniqueCase.mockReset();
    sendSms.mockReset();
    sendEmail.mockReset();
    smsConfigured.mockReset();
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue({});
    smsConfigured.mockReturnValue(false);
    findUniqueUser.mockResolvedValue({
      email: "a@example.com",
      name: "Ada",
      country: "IL",
    });
    findUniqueCase.mockResolvedValue({
      id: "c1",
      userId: "u1",
      ownershipVerifiedAt: null,
    });
  });

  it("does not claim magicDelivered when Outbox is only QUEUED", async () => {
    sendSms.mockResolvedValue({ status: "QUEUED" });
    sendEmail.mockResolvedValue({ status: "QUEUED" });
    const result = await sendOwnershipCode("u1", "+972500000000", "c1");
    expect(result).toMatchObject({
      ok: true,
      magicSent: true,
      magicDelivered: false,
      smsDelivered: false,
      devHint: true,
    });
  });

  it("sets magicDelivered only when email Outbox is SENT", async () => {
    sendSms.mockResolvedValue({ status: "QUEUED" });
    sendEmail.mockResolvedValue({ status: "SENT" });
    const result = await sendOwnershipCode("u1", "+972500000000", "c1");
    expect(result).toMatchObject({
      ok: true,
      magicSent: true,
      magicDelivered: true,
      smsDelivered: false,
    });
  });

  it("does not set magicSent when magic link cannot be issued", async () => {
    sendSms.mockResolvedValue({ status: "QUEUED" });
    findUniqueUser.mockResolvedValue({ email: null, name: "Ada", country: "IL" });
    const result = await sendOwnershipCode("u1", "+972500000000", "c1");
    expect(result).toMatchObject({
      ok: true,
      magicSent: false,
      magicDelivered: false,
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
