import { ENGINE_ZML_VERSION } from "./constants";

/** Same major ZML version = engine can evaluate packs. */
export function canEvaluateZml(zmlVersion: string, engineVersion = ENGINE_ZML_VERSION): boolean {
  const zmlMajor = zmlVersion.split(".")[0];
  const engMajor = engineVersion.split(".")[0];
  return zmlMajor === engMajor && zmlMajor.length > 0;
}

/** Parse semver range like `>=1.0.0 <2.0.0` from pack manifests (future CDN packs). */
export function satisfiesZmlRange(zmlVersion: string, range: string): boolean {
  const match = range.match(/>=\s*(\d+)\./);
  if (!match) return canEvaluateZml(zmlVersion);
  const minMajor = match[1];
  const major = zmlVersion.split(".")[0];
  if (major !== minMajor) return false;
  if (range.includes("<2") && major === "2") return false;
  return true;
}
