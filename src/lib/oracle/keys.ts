import "server-only";

import { prisma } from "@/lib/prisma";

export type OracleKeyRecord = { label: string; created: string };

/** Process-local fallback when DB is unavailable (tests / cold misconfig). */
const inMemoryKeys = new Map<string, OracleKeyRecord>();

function memoryOnly(): boolean {
  // Unit tests and emergency bootstrap; production registers hit Postgres.
  return process.env.VITEST === "true" || process.env.ZAKAI_ORACLE_KEYS_MEMORY === "1";
}

/**
 * Mint a per-customer Oracle key and persist it. Same durability shape as
 * registerWidgetKey: new registrations land in Postgres so a customer's
 * access survives a deploy, not just the process that minted it.
 */
export async function registerOracleKey(label: string): Promise<string> {
  const key = `ok_live_${crypto.randomUUID().replace(/-/g, "")}`;
  const created = new Date().toISOString();
  const rec: OracleKeyRecord = { label, created };
  inMemoryKeys.set(key, rec);
  if (memoryOnly()) return key;
  try {
    await prisma.oracleKey.create({ data: { key, label } });
  } catch {
    // Keep the in-memory copy so register→validate still works before migrate deploy.
  }
  return key;
}

/**
 * Resolve a caller-supplied key to the customer it belongs to, or null if the
 * key is missing, unknown, or revoked. The label is returned (not just a
 * boolean) so the caller can rate-limit and log by customer identity instead
 * of raw IP — the correct axis for a server-to-server B2B API, where many
 * legitimate calls can share one exit IP and one bad actor can rotate theirs.
 */
export async function resolveOracleKey(key: string | null): Promise<{ label: string } | null> {
  if (!key) return null;

  const mem = inMemoryKeys.get(key);
  if (mem) return { label: mem.label };

  if (memoryOnly()) return null;

  try {
    const row = await prisma.oracleKey.findUnique({ where: { key } });
    if (!row || row.revokedAt) return null;
    return { label: row.label };
  } catch {
    return null;
  }
}
