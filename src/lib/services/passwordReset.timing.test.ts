import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  hashPassword: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mocks.findUnique(...args),
    },
    passwordReset: {
      create: (...args: unknown[]) => mocks.create(...args),
    },
  },
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: (...args: unknown[]) => mocks.hashPassword(...args),
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/messaging", () => ({
  sendEmail: (...args: unknown[]) => mocks.sendEmail(...args),
}));

import { requestPasswordReset } from "./passwordReset";

/**
 * requestPasswordReset must return the identical {accepted:true} shape for a
 * known vs. unknown email (already true), AND pay a comparable real cost —
 * otherwise the two branches are distinguishable by response latency alone,
 * the same membership-oracle class of bug found and fixed in
 * signup/route.ts's duplicate-email branch.
 */
describe("requestPasswordReset — timing-equalized non-enumeration", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
    mocks.create.mockReset();
    mocks.hashPassword.mockReset();
    mocks.sendEmail.mockReset();
    mocks.hashPassword.mockResolvedValue("hashed");
    mocks.create.mockResolvedValue({ id: "pr_1" });
    mocks.sendEmail.mockResolvedValue({ status: "SENT" });
  });

  it("burns a real bcrypt cost on the unknown-email branch before returning", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const res = await requestPasswordReset("nobody@zakai.test", "https://zakai.test");

    expect(res).toEqual({ accepted: true });
    expect(mocks.hashPassword).toHaveBeenCalledTimes(1);
    expect(mocks.hashPassword).toHaveBeenCalledWith("nobody@zakai.test");
    // Never writes a real reset row or emails an address nobody controls.
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("does the real work (DB write + email) for a known account", async () => {
    mocks.findUnique.mockResolvedValue({ id: "user_1", name: "Ada", email: "ada@zakai.test" });

    const res = await requestPasswordReset("ada@zakai.test", "https://zakai.test");

    expect(res.accepted).toBe(true);
    expect(res.devToken).toBeTruthy();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });
});
