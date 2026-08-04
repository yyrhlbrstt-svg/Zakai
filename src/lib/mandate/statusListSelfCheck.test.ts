import { describe, expect, it } from "vitest";
import { generateKeyPair, exportJWK } from "jose";
import { selfCheckStatusListBit } from "./statusListSelfCheck";
import type { SigningKey } from "./mandate";

describe("selfCheckStatusListBit", () => {
  it("proves pack → sign → verify → bit flip", async () => {
    const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    const key: SigningKey = { kid: "ready-bit", privateJwk: await exportJWK(privateKey) };
    await expect(selfCheckStatusListBit(key, "https://zakai.example")).resolves.toEqual({
      ok: true,
    });
  });
});
