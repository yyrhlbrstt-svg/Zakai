/**
 * Prove the signed status-list bit path works end-to-end without touching DB:
 * pack → sign → verify → isRevoked(idx). Used by /api/mandate/ready so
 * "ready" is not theatre on an empty valid list.
 */

import type { SigningKey } from "./mandate";
import { publicJwkFor } from "./mandate";
import { signStatusList, verifyStatusList } from "./statusList";

export async function selfCheckStatusListBit(
  key: SigningKey,
  issuer: string,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  try {
    const idx = 7;
    const token = await signStatusList(
      {
        issuer,
        revokedIndices: [idx],
        size: 64,
        ttlSeconds: 900,
      },
      key,
    );
    const list = await verifyStatusList(token, {
      issuer,
      publicJwks: [await publicJwkFor(key)],
    });
    if (!list.isRevoked(idx)) {
      return { ok: false, detail: "bit_not_set_after_sign" };
    }
    if (list.isRevoked(0)) {
      return { ok: false, detail: "unrelated_bit_set" };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "self_check_failed" };
  }
}
