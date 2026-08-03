import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextStatusIndex, publishRevocation } from "./statusIndex";

describe("nextStatusIndex", () => {
  it("starts at 0 when the table is empty", async () => {
    const db = {
      mandateRevocation: {
        aggregate: vi.fn().mockResolvedValue({ _max: { statusIndex: null } }),
      },
    };
    await expect(nextStatusIndex(db as never)).resolves.toBe(0);
  });

  it("returns max + 1", async () => {
    const db = {
      mandateRevocation: {
        aggregate: vi.fn().mockResolvedValue({ _max: { statusIndex: 41 } }),
      },
    };
    await expect(nextStatusIndex(db as never)).resolves.toBe(42);
  });
});

describe("publishRevocation", () => {
  const revokedAt = new Date("2026-08-03T12:00:00.000Z");

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a row with a fresh statusIndex", async () => {
    const create = vi.fn().mockResolvedValue({
      jti: "jti-1",
      statusIndex: 0,
      revokedAt,
      reason: "ops",
    });
    const db = {
      mandateRevocation: {
        findUnique: vi.fn().mockResolvedValue(null),
        aggregate: vi.fn().mockResolvedValue({ _max: { statusIndex: null } }),
        create,
        update: vi.fn(),
      },
    };

    const row = await publishRevocation(db as never, { jti: "jti-1", reason: "ops" });
    expect(row.statusIndex).toBe(0);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ jti: "jti-1", statusIndex: 0, reason: "ops" }),
      }),
    );
  });

  it("repairs a legacy row that was published without an index", async () => {
    const update = vi.fn().mockResolvedValue({
      jti: "jti-legacy",
      statusIndex: 7,
      revokedAt,
      reason: "user_request",
    });
    const db = {
      mandateRevocation: {
        findUnique: vi.fn().mockResolvedValue({
          jti: "jti-legacy",
          statusIndex: null,
          revokedAt,
          reason: "user_request",
        }),
        aggregate: vi.fn().mockResolvedValue({ _max: { statusIndex: 6 } }),
        create: vi.fn(),
        update,
      },
    };

    const row = await publishRevocation(db as never, { jti: "jti-legacy" });
    expect(row.statusIndex).toBe(7);
    expect(update).toHaveBeenCalled();
    expect(db.mandateRevocation.create).not.toHaveBeenCalled();
  });

  it("is idempotent when the row is already indexed", async () => {
    const db = {
      mandateRevocation: {
        findUnique: vi.fn().mockResolvedValue({
          jti: "jti-ok",
          statusIndex: 3,
          revokedAt,
          reason: "user_request",
        }),
        aggregate: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    const row = await publishRevocation(db as never, { jti: "jti-ok" });
    expect(row.statusIndex).toBe(3);
    expect(db.mandateRevocation.aggregate).not.toHaveBeenCalled();
    expect(db.mandateRevocation.create).not.toHaveBeenCalled();
    expect(db.mandateRevocation.update).not.toHaveBeenCalled();
  });
});
