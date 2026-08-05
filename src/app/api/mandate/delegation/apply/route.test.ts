import { beforeEach, describe, expect, it, vi } from "vitest";

const rateLimit = vi.fn();
const sendEmail = vi.fn();
const reportError = vi.fn();
const create = vi.fn();

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
  clientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/messaging", () => ({
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));

vi.mock("@/lib/report-error", () => ({
  reportError: (...args: unknown[]) => reportError(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { delegationApplication: { create: (...args: unknown[]) => create(...args) } },
}));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("https://zakai.test/api/mandate/delegation/apply", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  slug: "example-agent",
  name: "Example Agent",
  contactEmail: "founder@example.test",
  useCase: "We help travelers file baggage claims automatically after long delays.",
  requestedScopes: ["read:bills", "negotiate:tariff"],
};

describe("POST /api/mandate/delegation/apply", () => {
  beforeEach(() => {
    rateLimit.mockReset();
    sendEmail.mockReset();
    reportError.mockReset();
    create.mockReset();
    rateLimit.mockResolvedValue({ ok: true });
    create.mockResolvedValue({ id: "app_1" });
    sendEmail.mockResolvedValue(undefined);
  });

  it("rate limits by IP", async () => {
    rateLimit.mockResolvedValue({ ok: false });
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(429);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a malformed slug without touching the database", async () => {
    const res = await POST(req({ ...VALID_BODY, slug: "Not Valid Slug!" }));
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a forbidden scope and reports which ones", async () => {
    const res = await POST(req({ ...VALID_BODY, requestedScopes: ["payment:initiate"] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("scope_forbidden");
    expect(body.scopes).toEqual(["payment:initiate"]);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an unknown scope and lists the known ones", async () => {
    const res = await POST(req({ ...VALID_BODY, requestedScopes: ["not:a:real:scope"] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("scope_unknown");
    expect(body.scopes).toEqual(["not:a:real:scope"]);
    expect(Array.isArray(body.known)).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it("persists a valid application and emails sales with the admission command", async () => {
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    expect(create).toHaveBeenCalledWith({
      data: {
        slug: "example-agent",
        name: "Example Agent",
        contactEmail: "founder@example.test",
        useCase: VALID_BODY.useCase,
        requestedScopes: ["read:bills", "negotiate:tariff"],
      },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const emailArgs = sendEmail.mock.calls[0][0];
    expect(emailArgs.subject).toContain("example-agent");
    expect(emailArgs.body).toContain("app_1");
    expect(emailArgs.body).toContain("read:bills, negotiate:tariff");
  });

  it("still returns ok when the row saved but the notification email fails", async () => {
    sendEmail.mockRejectedValue(new Error("smtp down"));
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(reportError).toHaveBeenCalled();
  });

  it("returns 500 without leaking a raw DB error when the row fails to persist", async () => {
    create.mockRejectedValue(new Error("connection reset"));
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(500);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalled();
  });
});
