import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  allocateStatusIndex,
  nextStatusIndex,
  publishRevocation,
  STATUS_LIST_CAPACITY,
  StatusIndexUnknownError,
  StatusListCapacityError,
  statusListUriForIssuer,
} from "./statusIndex";

describe("nextStatusIndex", () => {
  it("starts at 0 when empty", async () => {
    const db = {
      mandateRevocation: {
        aggregate: vi.fn().mockResolvedValue({ _max: { statusIndex: null } }),
      },
      authorization: {
        aggregate: vi.fn().mockResolvedValue({ _max: { mandateStatusIndex: null } }),
      },
      mandateStatusAllocation: {
        aggregate: vi.fn().mockResolvedValue({ _max: { statusIndex: null } }),
      },
    };
    await expect(nextStatusIndex(db as never)).resolves.toBe(0);
  });

  it("takes the max across revocation, authorization, and allocation", async () => {
    const db = {
      mandateRevocation: {
        aggregate: vi.fn().mockResolvedValue({ _max: { statusIndex: 3 } }),
      },
      authorization: {
        aggregate: vi.fn().mockResolvedValue({ _max: { mandateStatusIndex: 10 } }),
      },
      mandateStatusAllocation: {
        aggregate: vi.fn().mockResolvedValue({ _max: { statusIndex: 7 } }),
      },
    };
    await expect(nextStatusIndex(db as never)).resolves.toBe(11);
  });
});

describe("allocateStatusIndex", () => {
  it("reserves a row for the jti", async () => {
    const create = vi.fn().mockResolvedValue({ statusIndex: 0, jti: "jti-1" });
    const db = {
      mandateRevocation: {
        aggregate: vi.fn().mockResolvedValue({ _max: { statusIndex: null } }),
      },
      mandateStatusAllocation: {
        aggregate: vi.fn().mockResolvedValue({ _max: { statusIndex: null } }),
        create,
        findUnique: vi.fn(),
      },
    };
    const idx = await allocateStatusIndex(db as never, "jti-1");
    expect(idx).toBe(0);
    expect(create).toHaveBeenCalledWith({ data: { statusIndex: 0, jti: "jti-1" } });
  });
});

describe("publishRevocation", () => {
  const revokedAt = new Date("2026-08-03T12:00:00.000Z");

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the issue-time statusIndex when publishing", async () => {
    const create = vi.fn().mockResolvedValue({
      jti: "jti-1",
      statusIndex: 5,
      revokedAt,
      reason: "user_request",
    });
    const db = {
      mandateRevocation: {
        findUnique: vi.fn().mockResolvedValue(null),
        aggregate: vi.fn(),
        create,
        update: vi.fn(),
      },
      mandateStatusAllocation: {
        findUnique: vi.fn().mockResolvedValue({ statusIndex: 5 }),
        aggregate: vi.fn(),
        create: vi.fn(),
      },
    };

    const row = await publishRevocation(db as never, {
      jti: "jti-1",
      reason: "user_request",
      statusIndex: 5,
    });
    expect(row.statusIndex).toBe(5);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ jti: "jti-1", statusIndex: 5 }),
      }),
    );
  });

  it("repairs a legacy row when the issue-time index is supplied", async () => {
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
        aggregate: vi.fn(),
        create: vi.fn(),
        update,
      },
    };

    const row = await publishRevocation(db as never, {
      jti: "jti-legacy",
      statusIndex: 7,
    });
    expect(row.statusIndex).toBe(7);
    expect(update).toHaveBeenCalled();
  });

  it("refuses to invent a bit when no issue-time index exists", async () => {
    const db = {
      mandateRevocation: {
        findUnique: vi.fn().mockResolvedValue(null),
        aggregate: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      mandateStatusAllocation: {
        findUnique: vi.fn().mockResolvedValue(null),
        aggregate: vi.fn(),
        create: vi.fn(),
      },
      authorization: {
        aggregate: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    await expect(publishRevocation(db as never, { jti: "jti-orphan" })).rejects.toBeInstanceOf(
      StatusIndexUnknownError,
    );
    expect(db.mandateRevocation.create).not.toHaveBeenCalled();
  });

  it("reuses Authorization.mandateStatusIndex before inventing a new bit", async () => {
    const create = vi.fn().mockResolvedValue({
      jti: "jti-auth",
      statusIndex: 42,
      revokedAt,
      reason: "ops",
    });
    const db = {
      mandateRevocation: {
        findUnique: vi.fn().mockResolvedValue(null),
        aggregate: vi.fn(),
        create,
        update: vi.fn(),
      },
      mandateStatusAllocation: {
        findUnique: vi.fn().mockResolvedValue(null),
        aggregate: vi.fn(),
        create: vi.fn(),
      },
      authorization: {
        aggregate: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({ mandateStatusIndex: 42 }),
      },
    };

    const row = await publishRevocation(db as never, { jti: "jti-auth", reason: "ops" });
    expect(row.statusIndex).toBe(42);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statusIndex: 42 }),
      }),
    );
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

    const row = await publishRevocation(db as never, { jti: "jti-ok", statusIndex: 99 });
    expect(row.statusIndex).toBe(3);
    expect(db.mandateRevocation.create).not.toHaveBeenCalled();
  });
});

describe("allocateStatusIndex capacity", () => {
  it("refuses when the next index is at capacity", async () => {
    const db = {
      mandateRevocation: {
        aggregate: vi.fn().mockResolvedValue({ _max: { statusIndex: STATUS_LIST_CAPACITY - 1 } }),
      },
      mandateStatusAllocation: {
        aggregate: vi.fn().mockResolvedValue({ _max: { statusIndex: null } }),
        create: vi.fn(),
        findUnique: vi.fn(),
      },
    };
    await expect(allocateStatusIndex(db as never, "jti-full")).rejects.toBeInstanceOf(
      StatusListCapacityError,
    );
    expect(db.mandateStatusAllocation.create).not.toHaveBeenCalled();
  });
});

describe("statusListUriForIssuer", () => {
  it("strips trailing slash", () => {
    expect(statusListUriForIssuer("https://zakai.example/")).toBe(
      "https://zakai.example/api/mandate/revocations",
    );
  });
});
