import "server-only";

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

export function registerWidgetKey(domain: string): string {
  const key = `pk_live_${crypto.randomUUID().replace(/-/g, "")}`;
  const reg = parseRegistry();
  reg.set(key, { domain, created: new Date().toISOString() });
  // Ephemeral in-memory only unless persisted via env — admin must update ZAKAI_WIDGET_KEYS_JSON
  inMemoryKeys.set(key, reg.get(key)!);
  return key;
}

const inMemoryKeys = new Map<string, WidgetKeyRecord>();

export function validateWidgetKey(key: string | null, origin: string | null): boolean {
  if (!key) return false;
  const reg = parseRegistry();
  const mem = inMemoryKeys.get(key);
  const rec = mem ?? reg.get(key);
  if (!rec) return false;
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname;
    return host === rec.domain || host.endsWith(`.${rec.domain}`);
  } catch {
    return false;
  }
}
