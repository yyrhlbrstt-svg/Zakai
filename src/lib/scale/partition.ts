/**
 * Logical partition keys for append-only learn tables.
 * Used for aggregation, future read replicas, and physical sharding routes.
 */

export type OutcomePartitionKey = `${string}:${string}:${string}`;

/** Stable key: ISO market, vertical pack id, normalised counterparty. */
export function outcomePartitionKey(
  market: string,
  vertical: string,
  counterparty: string,
): OutcomePartitionKey {
  const m = market.trim().toUpperCase().slice(0, 2);
  const v = vertical.trim().toLowerCase().slice(0, 64);
  const c = counterparty.trim().toLowerCase().slice(0, 80);
  return `${m}:${v}:${c}`;
}

/** Parse a partition key produced by {@link outcomePartitionKey}. */
export function parseOutcomePartitionKey(key: string): {
  market: string;
  vertical: string;
  counterparty: string;
} | null {
  const parts = key.split(":");
  if (parts.length < 3) return null;
  const [market, vertical, ...rest] = parts;
  const counterparty = rest.join(":");
  if (!market || !vertical || !counterparty) return null;
  return { market, vertical, counterparty };
}
