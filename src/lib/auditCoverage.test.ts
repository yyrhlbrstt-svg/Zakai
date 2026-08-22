import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

/**
 * Every route that creates, uses, or destroys authority must leave a record.
 *
 * The audit table existed for months covering login, password reset and admin
 * access — the account, in other words — while the actions this product exists
 * to perform went unrecorded. Zakai writes to a person's bank in that person's
 * name; an Authorization row and an Outbox row prove the system did it, not
 * that a human asked it to, from where, and when. If somebody later says "I
 * never authorised that", the difference between those two is the whole answer.
 *
 * So the list is written down. A new route that touches authority and forgets
 * to log is a test failure rather than a discovery made during an argument.
 */
const MUST_LOG: Array<{ route: string; event: string; why: string }> = [
  {
    route: "src/app/api/cases/[id]/dispatch/route.ts",
    event: "case_dispatched",
    why: "the irreversible one — a demand leaves, addressed to a company, as them",
  },
  {
    route: "src/app/api/cases/[id]/ownership/verify/route.ts",
    event: "ownership_verified",
    why: "the gate everything downstream leans on",
  },
  {
    route: "src/app/api/ownership/magic/route.ts",
    event: "ownership_verified",
    why: "the same gate reached by email — the half that will carry the first real case",
  },
  {
    route: "src/app/api/authority/revoke/route.ts",
    event: "mandate_revoked",
    why: "withdrawing authority is as much a fact as granting it",
  },
  {
    route: "src/app/api/authority/revoke-all/route.ts",
    event: "mandate_revoked",
    why: "the emergency stop, and the one most worth being able to date afterwards",
  },
  {
    route: "src/app/api/account/export/route.ts",
    event: "account_exported",
    why: "a whole account in one file is what a stolen session comes for",
  },
  {
    route: "src/app/api/account/delete/route.ts",
    event: "account_deleted",
    why: "the record of an erasure must outlive the erasure",
  },
  {
    route: "src/app/api/auth/login/route.ts",
    event: "login_failed",
    why: "the only signal that somebody is trying passwords",
  },
];

describe("authority-changing routes are audited", () => {
  for (const { route, event, why } of MUST_LOG) {
    it(`${route.replace("src/app/api/", "")} records ${event} — ${why}`, () => {
      expect(existsSync(route), `${route} no longer exists — update this list deliberately`).toBe(
        true,
      );
      const src = readFileSync(route, "utf8");
      expect(src, `${route} does not call logSecurityEvent`).toContain("logSecurityEvent");
      expect(src, `${route} does not record "${event}"`).toContain(`"${event}"`);
    });
  }

  it("the mandate itself is recorded wherever one can be minted", () => {
    // Two paths mint a mandate — ownership verify and dispatch — and both had
    // to be found. A mandate that exists with no record of the click that
    // caused it is the exact gap this whole set closes.
    const minting = [
      "src/app/api/cases/[id]/ownership/verify/route.ts",
      "src/app/api/cases/[id]/dispatch/route.ts",
    ];
    for (const route of minting) {
      expect(readFileSync(route, "utf8"), `${route} must record mandate_issued`).toContain(
        '"mandate_issued"',
      );
    }
  });

  it("every declared event type is actually used somewhere", () => {
    // A declared-but-unused type is a claim of coverage that does not exist.
    const source = readFileSync("src/lib/security/securityEvent.ts", "utf8");
    const declared = [...source.matchAll(/^\s*\|?\s*"([a-z_]+)"$/gm)].map((m) => m[1]);
    expect(declared.length).toBeGreaterThan(5);

    const used = new Set(MUST_LOG.map((r) => r.event));
    // These three live on paths this list does not enumerate route-by-route.
    for (const t of ["login_success", "password_reset_requested", "password_reset_completed", "admin_access", "mandate_issued"]) {
      used.add(t);
    }
    const orphans = declared.filter((t) => !used.has(t));
    expect(orphans, `declared but never recorded: ${orphans.join(", ")}`).toEqual([]);
  });
});
