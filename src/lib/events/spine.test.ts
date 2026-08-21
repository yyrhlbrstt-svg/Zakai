import { describe, expect, it, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { zakaiEvent: { create: (...a: unknown[]) => create(...a) } } }));

const { recordEvent, EVENT_TYPES } = await import("./spine");

beforeEach(() => {
  create.mockReset();
  create.mockResolvedValue({ id: "evt_1" });
});

describe("the event spine writes only what it can validate", () => {
  it("appends a well-formed event and returns its id", async () => {
    const res = await recordEvent({
      eventType: "institution.responded",
      caseId: "case_1",
      institution: "cellcom",
      domain: "telecom",
      payload: { responseType: "settled", responseAmountAgorot: 12_000, hoursToRespond: 72 },
    });
    expect(res).toEqual({ ok: true, id: "evt_1" });
    const arg = create.mock.calls[0][0];
    expect(arg.data.eventType).toBe("institution.responded");
    expect(arg.data.payload.responseAmountAgorot).toBe(12_000);
    expect(arg.data.occurredAt).toBeInstanceOf(Date);
  });

  it("rejects a payload that does not match its event, without writing", async () => {
    const res = await recordEvent({
      eventType: "outcome.recorded",
      // @ts-expect-error deliberately wrong shape
      payload: { finalStatus: "maybe" },
    });
    expect(res).toEqual({ ok: false, reason: "invalid_payload" });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an event type outside the closed set", async () => {
    const res = await recordEvent({
      // @ts-expect-error deliberately unknown type
      eventType: "something.invented",
      payload: {},
    });
    expect(res).toEqual({ ok: false, reason: "unknown_event_type" });
    expect(create).not.toHaveBeenCalled();
  });

  it("never throws when the database is unavailable — history must not break the claim", async () => {
    create.mockRejectedValue(new Error("db down"));
    const res = await recordEvent({
      eventType: "claim.created",
      payload: { claimType: "telecom", estimatedValueAgorot: null, source: "scan" },
    });
    expect(res).toEqual({ ok: false, reason: "write_failed" });
  });

  it("exposes no update or delete — append-only is enforced by the module surface", async () => {
    const mod = await import("./spine");
    const names = Object.keys(mod);
    expect(names.some((n) => /update|delete|edit|remove/i.test(n))).toBe(false);
    expect(names).toContain("recordEvent");
  });

  it("keeps the event set closed and stable", () => {
    expect([...EVENT_TYPES]).toEqual([
      "claim.created",
      "mandate.signed",
      "institution.contacted",
      "institution.responded",
      "outcome.recorded",
      "policy.observed",
    ]);
  });

  it("normalises blank institution and domain to null so grouping stays clean", async () => {
    await recordEvent({
      eventType: "policy.observed",
      institution: "   ",
      domain: "",
      payload: { policyType: "early_exit_fee", description: "x", firstObservedViaCaseId: null },
    });
    const arg = create.mock.calls[0][0];
    expect(arg.data.institution).toBeNull();
    expect(arg.data.domain).toBeNull();
  });
});
