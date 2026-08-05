import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const create = vi.fn();
const rateLimit = vi.fn();
const hashPassword = vi.fn();
const createSession = vi.fn();
const sendEmail = vi.fn();
const sendVerificationEmail = vi.fn();
const reportError = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      create: (...args: unknown[]) => create(...args),
    },
  },
}));

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
  clientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: (...args: unknown[]) => hashPassword(...args),
}));

vi.mock("@/lib/auth/session", () => ({
  createSession: (...args: unknown[]) => createSession(...args),
}));

vi.mock("@/lib/messaging", () => ({
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));

vi.mock("@/lib/services/emailVerification", () => ({
  sendVerificationEmail: (...args: unknown[]) => sendVerificationEmail(...args),
}));

vi.mock("@/lib/report-error", () => ({ reportError: (...args: unknown[]) => reportError(...args) }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
  }),
}));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("http://localhost/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  name: "Ada",
  email: "ada@example.com",
  password: "correct-horse-battery",
  phone: "0501234567",
  country: "IL",
};

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset();
    rateLimit.mockReset();
    hashPassword.mockReset();
    createSession.mockReset();
    sendEmail.mockReset();
    sendVerificationEmail.mockReset();
    reportError.mockReset();

    rateLimit.mockResolvedValue({ ok: true });
    hashPassword.mockResolvedValue("hashed");
    create.mockResolvedValue({ id: "user_new" });
  });

  it(
    "returns the exact same {ok:true} shape and status for a duplicate email as for a fresh " +
      "signup — the enumeration fix: no distinguishable emailTaken/409 for an outside observer",
    async () => {
      findUnique.mockResolvedValueOnce({
        id: "user_existing",
        name: "Existing User",
        email: "ada@example.com",
      });

      const res = await POST(req(VALID_BODY));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: true });
    },
  );

  it("never creates a session for a duplicate-email request — that would log the requester into a stranger's account", async () => {
    findUnique.mockResolvedValueOnce({
      id: "user_existing",
      name: "Existing User",
      email: "ada@example.com",
    });

    await POST(req(VALID_BODY));

    expect(createSession).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("emails the real account owner instead of the requester on a duplicate", async () => {
    findUnique.mockResolvedValueOnce({
      id: "user_existing",
      name: "Existing User",
      email: "ada@example.com",
    });

    await POST(req(VALID_BODY));

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe("ada@example.com");
  });

  it("a real signup still creates the account and session and returns the identical {ok:true} shape", async () => {
    findUnique.mockResolvedValueOnce(null); // no existing user

    const res = await POST(req(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(create).toHaveBeenCalledTimes(1);
    expect(createSession).toHaveBeenCalledWith("user_new");
  });

  it("a mail failure on the duplicate path still returns ok:true (never leaks failure state)", async () => {
    findUnique.mockResolvedValueOnce({
      id: "user_existing",
      name: "Existing User",
      email: "ada@example.com",
    });
    sendEmail.mockRejectedValue(new Error("smtp down"));

    const res = await POST(req(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(reportError).toHaveBeenCalled();
  });
});
