import "server-only";

import { prisma } from "@/lib/prisma";

export type WidgetKeyRecord = { domain: string; created: string };

function parseEnvRegistry(): Map<string, WidgetKeyRecord> {
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

/** Process-local fallback when DB is unavailable (tests / cold misconfig). */
const inMemoryKeys = new Map<string, WidgetKeyRecord>();

function originMatchesDomain(origin: string | null, domain: string): boolean {
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname;
    return host === domain || host.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

function memoryOnly(): boolean {
  // Unit tests and emergency bootstrap; production registers hit Postgres.
  return process.env.VITEST === "true" || process.env.ZAKAI_WIDGET_KEYS_MEMORY === "1";
}

/**
 * Mint a partner key and persist it. Env JSON remains a read-side override for
 * bootstrap; new registrations land in Postgres so embeds survive deploys.
 */
export async function registerWidgetKey(domain: string): Promise<string> {
  const key = `pk_live_${crypto.randomUUID().replace(/-/g, "")}`;
  const created = new Date().toISOString();
  const rec: WidgetKeyRecord = { domain, created };
  inMemoryKeys.set(key, rec);
  if (memoryOnly()) return key;
  try {
    await prisma.widgetKey.create({
      data: { key, domain },
    });
  } catch {
    // Keep the in-memory copy so register→validate still works before migrate deploy.
  }
  return key;
}

export async function validateWidgetKey(
  key: string | null,
  origin: string | null,
): Promise<boolean> {
  if (!key) return false;

  const env = parseEnvRegistry().get(key);
  if (env) return originMatchesDomain(origin, env.domain);

  const mem = inMemoryKeys.get(key);
  if (mem) return originMatchesDomain(origin, mem.domain);

  if (memoryOnly()) return false;

  try {
    const row = await prisma.widgetKey.findUnique({ where: { key } });
    if (!row || row.revokedAt) return false;
    return originMatchesDomain(origin, row.domain);
  } catch {
    return false;
  }
}
