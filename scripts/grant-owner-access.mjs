#!/usr/bin/env node
/**
 * Grant the founder's own account full product + admin access, without
 * moving through checkout and without creating a way to grant anyone else
 * anything.
 *
 * Deliberately narrow: it only ever touches the account(s) already listed in
 * ADMIN_EMAIL — the same env var /founder itself trusts to decide who is the
 * founder — and it refuses to run at all if that account hasn't signed up
 * yet. There is no email argument. A script that took an arbitrary address
 * would be a "make anyone BUSINESS + verified" button; this is not that.
 *
 * What it sets, and why each one:
 *  - plan: "BUSINESS" — the superset tier (0% fee, unlimited cases, full
 *    scan, business tools). See src/lib/plans.ts for what each tier unlocks.
 *  - planUntil: null — "granted without payment" is an existing, already-
 *    handled state (see the User.planUntil doc comment): the expiry cron
 *    only downgrades accounts that HAD a date and passed it, so leaving this
 *    null means the grant never silently expires.
 *  - emailVerifiedAt: now, if not already set — /founder itself refuses
 *    entry to an unverified address on purpose (matching an address is not
 *    the same as controlling it); this script is run by the person who
 *    already controls the mailbox, so backfilling it here is the one
 *    justified shortcut around that check, not a bypass of it.
 *
 * Usage: run with production DB credentials in the environment —
 *   NEON_DATABASE_URL=... NEON_DATABASE_URL_UNPOOLED=... ADMIN_EMAIL=you@example.com node scripts/grant-owner-access.mjs
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

async function main() {
  const raw = process.env.ADMIN_EMAIL || "";
  const emails = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    console.error("ADMIN_EMAIL is not set — nothing to grant. Set it first (same var /founder reads).");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    for (const email of emails) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        console.error(`✗ ${email} — no account with this email exists yet. Sign up in the app first, then re-run.`);
        continue;
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          plan: "BUSINESS",
          planChangedAt: new Date(),
          planUntil: null,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
      });

      console.log(
        `✓ ${email} — plan=${updated.plan}, emailVerifiedAt=${updated.emailVerifiedAt?.toISOString()}. ` +
          `/he/founder now open to this account (once redeployed with ADMIN_EMAIL including it).`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
