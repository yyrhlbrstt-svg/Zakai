import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/ops/internalAdminGate", () => ({
  isInternalOpsRequest: vi.fn(),
}));

import { isInternalOpsRequest } from "@/lib/ops/internalAdminGate";

describe("GET /api/version", () => {
  beforeEach(() => {
    vi.mocked(isInternalOpsRequest).mockReset();
    vi.mocked(isInternalOpsRequest).mockReturnValue(false);
  });

  it("public JSON has no ai provider or markets list", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("https://x.test/api/version"));
    const body = await res.json();
    expect(body.version).toBeTruthy();
    expect(body).not.toHaveProperty("ai");
    expect(body).not.toHaveProperty("markets");
    expect(body).not.toHaveProperty("operations");
    expect(body.see.protocol).toContain("zakai-protocol");
  });
});
