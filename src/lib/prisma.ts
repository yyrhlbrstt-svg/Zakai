import { PrismaClient, Prisma } from "@prisma/client";

/**
 * One PrismaClient per process, and a pooled connection under it.
 *
 * WHY THE SINGLETON MATTERS MORE ON SERVERLESS THAN ANYWHERE ELSE
 *
 * Every Postgres connection costs the server memory, and `max_connections` is
 * a hard ceiling — Neon's smaller plans sit around 100. A serverless platform
 * answers a traffic spike by starting more lambdas, so the naive pattern (a
 * client per request) turns a good day into `FATAL: too many connections`,
 * and it does it precisely when the most people are trying to use the
 * product. The module-level instance below survives warm invocations, so a
 * lambda opens connections once rather than once per request.
 *
 * The `globalThis` stash is guarded to non-production on purpose: it exists
 * for Next's dev-mode hot reload, which re-evaluates modules and would
 * otherwise leak a client per edit. In production the module cache already
 * does the job, and a global would only widen the surface.
 *
 * WHY THAT IS STILL NOT ENOUGH, AND WHAT THE POOLER ADDS
 *
 * A singleton bounds connections per lambda, not across them. Fifty warm
 * lambdas each holding a handful is still hundreds of connections. That is
 * what a transaction-mode pooler (PgBouncer, or Neon's pooled endpoint, or
 * Prisma Accelerate) fixes: many client connections multiplexed onto few
 * server ones.
 *
 * The cost of transaction mode is real and worth stating: pooled connections
 * do not keep session state, so prepared statements and long-lived
 * transactions misbehave. That is why migrations MUST run over the direct
 * URL — see NEON_DATABASE_URL_UNPOOLED in CLAUDE.md and prisma/schema.prisma's
 * `directUrl`.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Above this, a query is worth knowing about before it is an incident.
 *
 * 500ms is not a target, it is a smoke alarm: anything slower than half a
 * second on a page somebody is waiting for has usually stopped being a query
 * and started being a missing index. Logged rather than thrown, because a
 * slow query is still a correct answer.
 */
export const SLOW_QUERY_MS = 500;

function createClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { level: "error", emit: "stdout" },
      { level: "warn", emit: process.env.NODE_ENV === "development" ? "stdout" : "event" },
      // Emitted as an event rather than printed: every query at debug volume
      // would bury the ones that matter, so the listener below prints only
      // the slow ones.
      { level: "query", emit: "event" },
    ],
  });

  /*
    Slow-query logging.

    The parameters are deliberately NOT logged. A query's params are the
    person's email, their case, the amount they are owed — logs are the one
    place that data leaks by accident, and the shape of the query is what
    tells you which index is missing anyway.
  */
  client.$on("query" as never, (e: Prisma.QueryEvent) => {
    if (e.duration < SLOW_QUERY_MS) return;
    const query = e.query.length > 300 ? `${e.query.slice(0, 300)}…` : e.query;
    console.warn(`[slow-query] ${e.duration}ms ${query}`);
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
