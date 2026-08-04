import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Read replica client for aggregate / oracle / fairness paths.
 * Falls back to primary when NEON_DATABASE_URL_READ_REPLICA is unset.
 */
const readUrl =
  process.env.NEON_DATABASE_URL_READ_REPLICA?.trim() ||
  process.env.DATABASE_URL_READ_REPLICA?.trim() ||
  "";

const globalForPrisma = globalThis as unknown as {
  prismaRead: PrismaClient | undefined;
};

function createReadClient(): PrismaClient {
  if (!readUrl) return prisma;
  return new PrismaClient({
    datasources: { db: { url: readUrl } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prismaRead = globalForPrisma.prismaRead ?? createReadClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaRead = prismaRead;
}

export function readReplicaConfigured(): boolean {
  return Boolean(readUrl);
}
