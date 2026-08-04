import "server-only";
import { prisma } from "@/lib/prisma";

export type WidgetKeyRecord = { domain: string; created: string };

function parseRegistry(): Map<string, WidgetKeyRecord> {
  const map = new Map<string, WidgetKeyRecord>();
  const raw = process.env.ZAKAI_WIDGET_KEYS_JSON?.trim();
  if (!raw) return map;
  try {
    const obj = JSON.parse(raw) as Record<string, string | WidgetKeyRecord>;
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === "string") {
        map.set(key, { domain: val, created: "env" });
      } else if (val && typeof val.domain === "string") {
        map.set(key, { domain: val.domain, created: val.created ?? "env" });
      }
    }
  } catch {
    /* ignore malformed env */
  }
  return map;
}

/**
 * In-memory cache only: a same-warm-instance fast path so a key registered
 * and validated in quick succession (tests, or two requests hitting the same
 * lambda) doesn't need a DB round trip. The `WidgetKey` table below is the
 * actual durable store — Vercel functions don't share memory across
 * instances/cold starts, so relying on this map alone silently lost every
 * key registered via POST /api/widget/register after the first cold start.
 */
const inMemoryKeys = new Map<string, WidgetKeyRecord>();

export async function registerWidgetKey(domain: string): Promise<string> {
  const key = `pk_live_${crypto.randomUUID().replace(/-/g, "")}`;
  const rec: WidgetKeyRecord = { domain, created: new Date().toISOString() };
  inMemoryKeys.set(key, rec);
  try {
    await prisma.widgetKey.create({ data: { key, domain } });
  } catch {
    // DB unreachable (or unset locally) — key still works for this warm
    // instance via inMemoryKeys, and can be pinned permanently by adding it
    // to ZAKAI_WIDGET_KEYS_JSON.
  }
  return key;
}

export async function validateWidgetKey(key: string | null, origin: string | null): Promise<boolean> {
  if (!key) return false;
  const mem = inMemoryKeys.get(key);
  const env = parseRegistry().get(key);
  let rec = mem ?? env;
  if (!rec) {
    try {
      const row = await prisma.widgetKey.findUnique({ where: { key } });
      if (row) rec = { domain: row.domain, created: row.createdAt.toISOString() };
    } catch {
      // DB unreachable — fall through with rec still undefined, key invalid.
    }
  }
  if (!rec) return false;
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname;
    return host === rec.domain || host.endsWith(`.${rec.domain}`);
  } catch {
    return false;
  }
}
