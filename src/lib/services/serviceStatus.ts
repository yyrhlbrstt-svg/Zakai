import "server-only";
import { prisma } from "@/lib/prisma";
import { emailConfigured } from "@/lib/messaging";
import { paymentsFullyLive } from "@/lib/deploy/releaseGate";
import { aiAvailable } from "@/lib/ai";
import { loadSigningKeyFromEnv } from "@/lib/mandate/mandate";

/**
 * What is working right now, said in terms of what a person can do.
 *
 * A status page that reports "all systems operational" in green while letters
 * are piling up undelivered is worse than no status page: it is a claim, made
 * by us, that turns out to be false for the one thing the person cared about.
 *
 * So each row here is a capability rather than a component — "letters actually
 * leave", not "SMTP" — and each degraded row says what still works and what
 * does not. Nothing here fingerprints infrastructure: no hostnames, no
 * versions, no provider names beyond whether one is configured at all.
 */

export type StatusLevel = "up" | "degraded" | "down";

export interface StatusRow {
  key:
    | "site"
    | "database"
    | "letters"
    | "authority"
    | "payments"
    | "assistant";
  level: StatusLevel;
}

export interface ServiceStatus {
  rows: StatusRow[];
  /** Worst level present — what the headline reads. */
  overall: StatusLevel;
  checkedAt: Date;
}

const WORST: Record<StatusLevel, number> = { up: 0, degraded: 1, down: 2 };

export async function loadServiceStatus(): Promise<ServiceStatus> {
  let database: StatusLevel = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "up";
  } catch {
    database = "down";
  }

  let authority: StatusLevel;
  try {
    loadSigningKeyFromEnv();
    authority = "up";
  } catch {
    // No signing key means no mandate can be issued at all — not a degraded
    // service, an absent one, however well the rest of the site renders.
    authority = "down";
  }

  const rows: StatusRow[] = [
    // If this page rendered, the site served a request. Reporting anything
    // else here would be a status page lying about itself.
    { key: "site", level: "up" },
    { key: "database", level: database },
    // Degraded, not down: without a mail transport the letter is still
    // written, stored and downloadable — it just does not leave by itself.
    { key: "letters", level: emailConfigured() ? "up" : "degraded" },
    { key: "authority", level: authority },
    // Degraded, not down: the whole flow works end to end under the mock
    // provider, no card data is collected and no money moves.
    { key: "payments", level: paymentsFullyLive() ? "up" : "degraded" },
    { key: "assistant", level: aiAvailable() ? "up" : "degraded" },
  ];

  const overall = rows.reduce<StatusLevel>(
    (acc, r) => (WORST[r.level] > WORST[acc] ? r.level : acc),
    "up",
  );

  return { rows, overall, checkedAt: new Date() };
}
