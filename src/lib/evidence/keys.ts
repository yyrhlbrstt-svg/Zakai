import "server-only";

import { prisma } from "@/lib/prisma";

export type EvidenceKeyRecord = { label: string; created: string };

/** Process-local fallback when DB is unavailable (tests / cold misconfig). */
const inMemoryKeys = new Map<string, EvidenceKeyRecord>();

function memoryOnly(): boolean {
  return process.env.VITEST === "true" || process.env.ZAKAI_EVIDENCE_KEYS_MEMORY === "1";
}

/** Mint a per-customer evidence-API key and persist it (mirrors registerOracleKey). */
export async function registerEvidenceKey(label: string): Promise<string> {
  const key = `ev_live_${crypto.randomUUID().replace(/-/g, "")}`;
  const created = new Date().toISOString();
  const rec: EvidenceKeyRecord = { label, created };
  inMemoryKeys.set(key, rec);
  if (memoryOnly()) return key;
  try {
    await prisma.evidenceKey.create({ data: { key, label } });
  } catch {
    // Keep the in-memory copy so register→resolve still works before migrate deploy.
  }
  return key;
}

/** Resolve a caller-supplied key to the customer it belongs to, or null. */
export async function resolveEvidenceKey(key: string | null): Promise<{ label: string } | null> {
  if (!key) return null;

  const mem = inMemoryKeys.get(key);
  if (mem) return { label: mem.label };

  if (memoryOnly()) return null;

  try {
    const row = await prisma.evidenceKey.findUnique({ where: { key } });
    if (!row || row.revokedAt) return null;
    return { label: row.label };
  } catch {
    return null;
  }
}
