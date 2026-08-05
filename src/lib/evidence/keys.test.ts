import { describe, it, expect } from "vitest";
import { registerEvidenceKey, resolveEvidenceKey } from "@/lib/evidence/keys";

describe("evidence keys", () => {
  it("resolves a registered key to its customer label", async () => {
    const key = await registerEvidenceKey("Plaintiff Firm LLP");
    await expect(resolveEvidenceKey(key)).resolves.toEqual({ label: "Plaintiff Firm LLP" });
  });

  it("rejects an unknown key", async () => {
    await expect(resolveEvidenceKey("ev_live_does_not_exist")).resolves.toBeNull();
  });

  it("rejects a null/empty key without throwing", async () => {
    await expect(resolveEvidenceKey(null)).resolves.toBeNull();
    await expect(resolveEvidenceKey("")).resolves.toBeNull();
  });

  it("mints keys with the ev_live_ prefix", async () => {
    const key = await registerEvidenceKey("Some Regulator");
    expect(key).toMatch(/^ev_live_/);
  });
});
