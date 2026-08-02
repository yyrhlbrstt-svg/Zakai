/**
 * Runtime pack loader — built-in `MARKETS` today.
 * When `ZML_PACKS_CDN` is configured, manifests are validated then the engine
 * still uses built-in packs until CDN→JurisdictionPack conversion ships (PR #5).
 */
import { MARKETS } from "@/lib/global/registry";
import type { JurisdictionPack } from "@/lib/global/types";
import { canEvaluateZml } from "@/lib/protocol/zml/compatibility";
import { ENGINE_ZML_VERSION, ZML_VERSION } from "@/lib/protocol/zml/constants";

const PACKS_CDN = process.env.ZML_PACKS_CDN?.replace(/\/+$/, "");

export async function loadPack(market: string): Promise<JurisdictionPack> {
  const code = market.toUpperCase();
  if (PACKS_CDN) {
    try {
      const manifest = await fetch(`${PACKS_CDN}/${code}/index.json`, {
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : null));
      const zmlVer = (manifest?.engine_requirements?.zml_version as string) ?? ZML_VERSION;
      if (manifest && !canEvaluateZml(zmlVer)) {
        throw new Error(`Pack ${code} requires compatible ZML (${zmlVer})`);
      }
    } catch {
      /* CDN optional — built-in is authoritative until external packs land */
    }
  }
  const builtin = MARKETS[code];
  if (!builtin) throw new Error(`Unknown market ${code}`);
  if (!canEvaluateZml(ZML_VERSION, ENGINE_ZML_VERSION)) {
    throw new Error("Engine ZML version mismatch");
  }
  return builtin.pack;
}
