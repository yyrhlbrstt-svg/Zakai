import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The two history tables must stay append-only, in the database and in here.
 *
 * A trigger in Postgres stops the write. This stops the code that would try —
 * which matters because the failure mode of the trigger alone is a 500 in
 * production on a path somebody added months from now, discovered by a user
 * rather than by CI. The migration is the guarantee; this is the seatbelt that
 * says so before it is needed.
 *
 * Both tables carry the same property for the same reason: every other table
 * here describes the present and can be rebuilt from reality, while these two
 * are the only record of what happened. An audit row's whole value is that it
 * could not have been changed afterwards.
 */

const AUDIT_MODELS = ["securityEvent", "zakaiEvent"];
const MUTATIONS = ["update", "updateMany", "delete", "deleteMany", "upsert"];

/** `prisma.`, `prismaRead.`, and the `tx.` / `db.` aliases used in transactions. */
const CLIENTS = ["prisma", "prismaRead", "tx", "db", "client"];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("the audit tables are append-only", () => {
  it("no code anywhere updates or deletes an audit row", () => {
    const offenders: string[] = [];
    const patterns = AUDIT_MODELS.flatMap((model) =>
      CLIENTS.flatMap((client) =>
        MUTATIONS.map((op) => ({
          re: new RegExp(`\\b${client}\\.${model}\\.${op}\\b`),
          label: `${client}.${model}.${op}`,
        })),
      ),
    );

    for (const file of sourceFiles("src")) {
      const src = readFileSync(file, "utf8");
      for (const { re, label } of patterns) {
        if (re.test(src)) offenders.push(`${file} → ${label}`);
      }
    }

    expect(
      offenders,
      offenders.length
        ? `Audit history may only be appended to. A correction is a new row, never an edited one.\n${offenders.join("\n")}`
        : "",
    ).toEqual([]);
  });

  it("the migration that enforces it in the database is still present", () => {
    // Deleting the migration would leave the ratchet above passing while the
    // actual guarantee was gone — the failure this pairing exists to prevent.
    const dir = "prisma/migrations";
    const migration = readdirSync(dir).find((d) => d.endsWith("_append_only_audit"));
    expect(migration, "the append-only migration has been removed").toBeTruthy();

    const sql = readFileSync(join(dir, migration!, "migration.sql"), "utf8");
    for (const trigger of [
      "security_event_no_update",
      "security_event_no_delete",
      "security_event_no_truncate",
      "zakai_event_restricted_update",
      "zakai_event_no_delete",
      "zakai_event_no_truncate",
    ]) {
      expect(sql, `missing trigger ${trigger}`).toContain(trigger);
    }
  });

  it("keeps the one update account deletion depends on", () => {
    // ZakaiEvent.caseId is onDelete:SetNull and User→Case is Cascade, so
    // deleting an account UPDATEs these rows. Blocking that outright would turn
    // a privacy guarantee into a privacy bug.
    const dir = "prisma/migrations";
    const migration = readdirSync(dir).find((d) => d.endsWith("_append_only_audit"))!;
    const sql = readFileSync(join(dir, migration, "migration.sql"), "utf8");
    expect(sql).toContain('NEW."caseId" IS NULL');
    expect(sql).toContain('OLD."payload"     IS NOT DISTINCT FROM NEW."payload"');
  });
});
