import { describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const isAdminEmail = vi.fn();
const isEmailVerified = vi.fn();
const update = vi.fn();

vi.mock("@/lib/auth/user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/ops/internalAdminGate", () => ({ isAdminEmail: (e: string) => isAdminEmail(e) }));
vi.mock("@/lib/services/emailVerification", () => ({ isEmailVerified: (id: string) => isEmailVerified(id) }));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { update: (...args: unknown[]) => update(...args) } },
}));

async function callRoute() {
  const { POST } = await import("./route");
  const res = await POST();
  return { res, body: await res.json() };
}

describe("POST /api/founder/grant-owner-access", () => {
  it("refuses when not logged in", async () => {
    getCurrentUser.mockResolvedValueOnce(null);
    const { res, body } = await callRoute();
    expect(res.status).toBe(401);
    expect(body.error).toBe("mustLogin");
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses when the email is not in ADMIN_EMAIL", async () => {
    getCurrentUser.mockResolvedValueOnce({ id: "u1", email: "not-admin@example.com", plan: "FREE" });
    isAdminEmail.mockReturnValueOnce(false);
    const { res, body } = await callRoute();
    expect(res.status).toBe(403);
    expect(body.error).toBe("forbidden");
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses when the email is unverified", async () => {
    getCurrentUser.mockResolvedValueOnce({ id: "u1", email: "admin@example.com", plan: "FREE" });
    isAdminEmail.mockReturnValueOnce(true);
    isEmailVerified.mockResolvedValueOnce(false);
    const { res, body } = await callRoute();
    expect(res.status).toBe(403);
    expect(body.error).toBe("emailNotVerified");
    expect(update).not.toHaveBeenCalled();
  });

  it("grants BUSINESS plan once all gates pass", async () => {
    getCurrentUser.mockResolvedValueOnce({ id: "u1", email: "admin@example.com", plan: "FREE" });
    isAdminEmail.mockReturnValueOnce(true);
    isEmailVerified.mockResolvedValueOnce(true);
    update.mockResolvedValueOnce({ plan: "BUSINESS" });
    const { res, body } = await callRoute();
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, plan: "BUSINESS" });
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { plan: "BUSINESS", planChangedAt: expect.any(Date), planUntil: null },
    });
  });
});
