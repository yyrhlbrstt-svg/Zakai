#!/usr/bin/env node
/**
 * Admit one delegated issuer pilot (founder-only). Prints API key once — store in a secret manager.
 *
 * Usage:
 *   DELEGATED_PILOT_SLUG=agent.example \
 *   DELEGATED_PILOT_NAME="Agent Example" \
 *   DELEGATED_PILOT_SCOPES='["read:bills","dispute:charge"]' \
 *   node scripts/admit-delegated-pilot.mjs
 */
import { createHash, randomBytes } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

function hashIssuerKey(key) {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

async function main() {
  const slug = process.env.DELEGATED_PILOT_SLUG?.trim();
  const name = process.env.DELEGATED_PILOT_NAME?.trim();
  const scopesRaw = process.env.DELEGATED_PILOT_SCOPES?.trim() || '["read:bills"]';
  if (!slug || !name) {
    console.error("Set DELEGATED_PILOT_SLUG and DELEGATED_PILOT_NAME");
    process.exit(1);
  }
  let allowedScopes;
  try {
    allowedScopes = JSON.parse(scopesRaw);
    if (!Array.isArray(allowedScopes) || allowedScopes.length === 0) throw new Error("scopes");
  } catch {
    console.error("DELEGATED_PILOT_SCOPES must be a JSON array of scope strings");
    process.exit(1);
  }

  const key = `zkid_${randomBytes(32).toString("base64url")}`;

  const prisma = new PrismaClient();
  try {
    await prisma.delegatedIssuer.upsert({
      where: { slug },
      create: {
        slug,
        name,
        keyHash: hashIssuerKey(key),
        allowedScopes,
        status: "active",
      },
      update: {
        name,
        allowedScopes,
        status: "active",
        keyHash: hashIssuerKey(key),
      },
    });
  } finally {
    await prisma.$disconnect();
  }

  console.log("\nDelegated issuer admitted:");
  console.log("  slug:", slug);
  console.log("  scopes:", allowedScopes.join(", "));
  console.log("\nIssue key (shown once — header X-Zakai-Issue-Key):");
  console.log(key);
  console.log("\nPublic roster: GET /api/mandate/delegation/issuers");
  console.log("Issue: POST /api/mandate/issue");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
