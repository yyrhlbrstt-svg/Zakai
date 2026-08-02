import type { ZmlRight } from "./types";

/** Rights past `metadata.sunset_date` are hidden from catalog (not deleted). */
export function isZmlSunset(right: ZmlRight, now = new Date()): boolean {
  const raw = right.metadata?.sunset_date;
  if (!raw) return false;
  const sunset = new Date(raw);
  if (Number.isNaN(sunset.getTime())) return false;
  return sunset <= now;
}

/** Keep the newest `last_verified` row per logical id (strip @suffix). */
export function dedupeZmlRights(rights: ZmlRight[]): ZmlRight[] {
  const byBase = new Map<string, ZmlRight>();
  for (const r of rights) {
    if (isZmlSunset(r)) continue;
    const base = r.id.split("@")[0]!;
    const existing = byBase.get(base);
    if (!existing) {
      byBase.set(base, r);
      continue;
    }
    const va = r.metadata?.last_verified ?? r.version ?? "0";
    const vb = existing.metadata?.last_verified ?? existing.version ?? "0";
    if (va.localeCompare(vb) > 0) byBase.set(base, r);
  }
  return [...byBase.values()].sort((a, b) => a.id.localeCompare(b.id));
}
