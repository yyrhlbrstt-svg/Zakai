import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Every model in the schema has a table somebody actually created.
 *
 * THE FAILURE THIS CATCHES
 *
 * `prisma migrate deploy` runs during the Vercel build, so a *broken* migration
 * fails the build — that direction is already safe. The dangerous direction is
 * the opposite one: adding a model to `schema.prisma` and forgetting the
 * migration. Nothing fails. The build is green, the deploy succeeds, Prisma
 * generates a client that knows about the table, and the first request that
 * touches it 500s in production against a database that has never heard of it.
 *
 * This repository has already been in that state: the database this was
 * written against had no `_prisma_migrations` table at all, meaning its schema
 * had been pushed rather than migrated, and the two could drift with nothing
 * saying so.
 *
 * WHAT THIS DOES NOT CHECK
 *
 * Columns. A field added to an existing model without a migration still slips
 * through here, and catching that honestly needs a shadow database — which CI
 * does not have. Model-level is the part that can be checked with no database
 * at all, and it is the case that actually keeps happening, because a new model
 * is the change most likely to be made in a hurry.
 *
 * The full check is one command against a real database, and it is worth
 * running by hand before a schema release:
 *
 *   npx prisma migrate diff --from-url "$NEON_DATABASE_URL_UNPOOLED" \
 *     --to-schema-datamodel prisma/schema.prisma --exit-code
 */

const SCHEMA = readFileSync("prisma/schema.prisma", "utf8");
const MIGRATIONS_DIR = "prisma/migrations";

function allMigrationSql(): string {
  const parts: string[] = [];
  for (const entry of readdirSync(MIGRATIONS_DIR)) {
    const dir = join(MIGRATIONS_DIR, entry);
    if (!statSync(dir).isDirectory()) continue;
    const file = join(dir, "migration.sql");
    try {
      parts.push(readFileSync(file, "utf8"));
    } catch {
      // A migration directory with no migration.sql is itself a problem, and
      // the assertion below reports it rather than this loop swallowing it.
      parts.push(`-- MISSING migration.sql in ${entry}`);
    }
  }
  return parts.join("\n");
}

/** Model names, with any @@map override taken into account. */
function modelsWithTableNames(): { model: string; table: string }[] {
  const out: { model: string; table: string }[] = [];
  const blocks = SCHEMA.split(/\nmodel\s+/).slice(1);
  for (const block of blocks) {
    const model = block.slice(0, block.indexOf(" ")).trim();
    const mapped = /@@map\("([^"]+)"\)/.exec(block);
    out.push({ model, table: mapped ? mapped[1] : model });
  }
  return out;
}

describe("schema and migrations agree", () => {
  const sql = allMigrationSql();
  const models = modelsWithTableNames();

  it("finds the schema and the migrations at all", () => {
    expect(models.length).toBeGreaterThan(20);
    expect(sql.length).toBeGreaterThan(5_000);
  });

  it("every migration directory contains its SQL", () => {
    expect(sql).not.toContain("MISSING migration.sql");
  });

  it("every model has a CREATE TABLE in some migration", () => {
    const missing = models.filter(
      ({ table }) => !new RegExp(`CREATE TABLE\\s+(?:IF NOT EXISTS\\s+)?"${table}"`, "i").test(sql),
    );
    expect(
      missing.map((m) => m.model),
      missing.length > 0
        ? `Models with no migration that creates their table: ${missing
            .map((m) => m.model)
            .join(", ")}. Adding a model to schema.prisma without a migration ` +
          `builds green and 500s in production on the first request that touches it. ` +
          `Run: npx prisma migrate dev --name <what_changed>`
        : "",
    ).toEqual([]);
  });

  it("every enum has a CREATE TYPE in some migration", () => {
    const enums = [...SCHEMA.matchAll(/\nenum\s+(\w+)\s*\{/g)].map((m) => m[1]);
    expect(enums.length).toBeGreaterThan(0);
    const missing = enums.filter(
      (e) => !new RegExp(`CREATE TYPE\\s+"(?:public\\.)?${e}"`, "i").test(sql),
    );
    expect(missing, `Enums with no migration: ${missing.join(", ")}`).toEqual([]);
  });
});
