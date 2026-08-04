import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/services/expressCaseOpen", () => ({
  findOpenLoopBlock: vi.fn(),
}));

import { findOpenLoopBlock } from "@/lib/services/expressCaseOpen";
import { postAuthDestination } from "./postAuthDestination";

describe("postAuthDestination", () => {
  beforeEach(() => {
    vi.mocked(findOpenLoopBlock).mockReset();
  });

  it("returns open-loop nextHref when a loop is unfinished", async () => {
    vi.mocked(findOpenLoopBlock).mockResolvedValue({
      error: "OPEN_LOOP",
      nextHref: "/money?case=c1",
      caseId: "c1",
    });
    expect(await postAuthDestination("u1")).toBe("/money?case=c1");
  });

  it("falls back to /money when no open loop", async () => {
    vi.mocked(findOpenLoopBlock).mockResolvedValue(null);
    expect(await postAuthDestination("u1")).toBe("/money");
  });
});
