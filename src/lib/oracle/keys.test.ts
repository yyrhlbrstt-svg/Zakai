import { describe, it, expect } from "vitest";
import { registerOracleKey, resolveOracleKey } from "@/lib/oracle/keys";

describe("oracle keys", () => {
  it("resolves a registered key to its customer label", async () => {
    const key = await registerOracleKey("Acme Insurance");
    await expect(resolveOracleKey(key)).resolves.toEqual({ label: "Acme Insurance" });
  });

  it("rejects an unknown key", async () => {
    await expect(resolveOracleKey("ok_live_does_not_exist")).resolves.toBeNull();
  });

  it("rejects a null/empty key without throwing", async () => {
    await expect(resolveOracleKey(null)).resolves.toBeNull();
    await expect(resolveOracleKey("")).resolves.toBeNull();
  });

  it("mints keys with the ok_live_ prefix, distinct from widget's pk_live_", async () => {
    const key = await registerOracleKey("Some Fund");
    expect(key).toMatch(/^ok_live_/);
  });
});
