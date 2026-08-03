import { describe, expect, it } from "vitest";

describe("/api/pipe", () => {
  it("returns pipe manifest with health", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/pipe"));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.spec).toBe("zakai-pipe");
    expect(body.rails.authority.accept).toContain("/api/pipe/accept");
    expect(typeof body.health.pipe_ready).toBe("boolean");
  });
});

describe("/api/pipe/handoff", () => {
  it("returns attributed url for known door", async () => {
    const { POST } = await import("./handoff/route");
    const res = await POST(
      new Request("http://localhost/api/pipe/handoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent: "test-bot", door: "cancel", locale: "he" }),
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.url).toContain("/he/cancel?");
    expect(body.url).toContain("utm_source=agent");
  });

  it("rejects unknown door", async () => {
    const { POST } = await import("./handoff/route");
    const res = await POST(
      new Request("http://localhost/api/pipe/handoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent: "test-bot", door: "not-real" }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
