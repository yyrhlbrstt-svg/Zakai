#!/usr/bin/env node
/**
 * Generate the Ed25519 key pair that signs mandates and status lists.
 *
 * Without this an operator has no way to produce MANDATE_SIGNING_JWK, so
 * /api/mandate/revocations returns 503 and the protocol is inert — the whole
 * trust layer blocked on a step nobody had a tool for.
 *
 *   node scripts/generate-mandate-key.mjs
 *
 * Prints the private JWK for the environment and the public JWK for reference.
 * Nothing is written to disk: a private key in a file in a repository is a
 * private key in the repository, eventually.
 */
import { generateKeyPair, exportJWK } from "jose";

const kid = process.argv[2] || `zakai-${new Date().toISOString().slice(0, 7)}`;
const { publicKey, privateKey } = await generateKeyPair("EdDSA", {
  crv: "Ed25519",
  extractable: true,
});

const priv = await exportJWK(privateKey);
const pub = await exportJWK(publicKey);

console.log(`\n# Key id\nMANDATE_SIGNING_KID=${kid}\n`);
console.log(`# Private key — set this in the host's environment. Never commit it.`);
// Single-quoted: the value is JSON, and an unquoted one is silently mangled by
// any shell that sources it. The failure then looks identical to the variable
// being missing, which is the worst kind of configuration bug.
console.log(`MANDATE_SIGNING_JWK='${JSON.stringify({ ...priv, kid, alg: "EdDSA", use: "sig" })}'\n`);
console.log(`# Public key — served at /.well-known/zakai-jwks.json, safe to share.`);
console.log(JSON.stringify({ keys: [{ ...pub, kid, alg: "EdDSA", use: "sig" }] }, null, 2));
console.log(`
# Rotation: add the new key to the JWKS and keep the old one published until
# every mandate signed with it has expired. Verifiers try every key in the set,
# so an overlap costs nothing and removing the old key early invalidates
# credentials that are still legitimately in force.
`);
