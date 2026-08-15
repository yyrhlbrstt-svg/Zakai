import { describe, expect, it, vi } from "vitest";

const create = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { securityEvent: { create: (...args: unknown[]) => create(...args) } },
}));

describe("logSecurityEvent", () => {
  it("writes the event with the given fields", async () => {
    const { logSecurityEvent } = await import("./securityEvent");
    create.mockResolvedValueOnce({});
    await logSecurityEvent({ type: "login_failed", ip: "1.2.3.4", detail: "someone@example.com" });
    expect(create).toHaveBeenCalledWith({
      data: { type: "login_failed", userId: null, ip: "1.2.3.4", detail: "someone@example.com" },
    });
  });

  it("defaults userId to null and detail to empty string", async () => {
    const { logSecurityEvent } = await import("./securityEvent");
    create.mockResolvedValueOnce({});
    await logSecurityEvent({ type: "admin_access", ip: "5.6.7.8" });
    expect(create).toHaveBeenCalledWith({
      data: { type: "admin_access", userId: null, ip: "5.6.7.8", detail: "" },
    });
  });

  it("never throws when the write fails — audit logging must not break the request", async () => {
    const { logSecurityEvent } = await import("./securityEvent");
    create.mockRejectedValueOnce(new Error("db down"));
    await expect(
      logSecurityEvent({ type: "login_success", userId: "u1", ip: "1.1.1.1" }),
    ).resolves.toBeUndefined();
  });
});
