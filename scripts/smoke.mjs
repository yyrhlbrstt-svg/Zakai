#!/usr/bin/env node
/**
 * Smoke test against a running production server.
 *
 * A green build says the code compiles. It says nothing about whether a person
 * who types the address gets a page, in their language, with the trust
 * endpoints an institution needs. Everything below is fetched over HTTP from a
 * real `next start`, because that is the only version of "it works" that is
 * about the product rather than about the compiler.
 */
const BASE = process.argv[2] || "http://127.0.0.1:3000";
const results = [];

async function check(name, path, assert) {
  try {
    const res = await fetch(BASE + path, { redirect: "manual" });
    const body = res.status < 400 ? await res.text() : "";
    const problem = assert({ status: res.status, body, headers: res.headers });
    results.push({ name, path, ok: !problem, problem });
  } catch (err) {
    results.push({ name, path, ok: false, problem: String(err) });
  }
}

const ok = ({ status }) => (status >= 200 && status < 400 ? null : `status ${status}`);
const contains = (needle) => ({ status, body }) =>
  status >= 400 ? `status ${status}` : body.includes(needle) ? null : `missing ${JSON.stringify(needle)}`;

// The four locales a person can actually land in.
await check("root redirects to a locale", "/", ({ status, headers }) =>
  status === 307 || status === 308 ? null : `expected a redirect, got ${status} -> ${headers.get("location")}`);
for (const l of ["he", "en", "ar", "ru"]) {
  await check(`/${l} renders`, `/${l}`, ok);
}

// The Hebrew homepage must not have regressed to the English stub.
await check("homepage is not the English stub", "/he", ({ body }) =>
  /category leader|Where do you start\?|Markets:/.test(body)
    ? "internal English copy is back on the homepage"
    : null);

// Account recovery — the path that was entirely missing.
await check("forgot-password page", "/he/forgot", ok);
await check("reset page", "/he/reset", ok);

// What an institution fetches, from anywhere, with no account.
await check("JWKS", "/.well-known/zakai-jwks.json", ok);
await check("mandate discovery", "/.well-known/zakai-mandate.json", ok);
await check("trust registry", "/.well-known/zakai-trust-registry.json", contains("forbiddenScopes"));
await check("registry forbids outward payment", "/.well-known/zakai-trust-registry.json",
  contains("payment:initiate"));
await check("conformance suite", "/.well-known/zakai-conformance.json", contains("revocation_takes_effect"));
await check("mandate OpenAPI", "/api/mandate/openapi.json", ok);

// CORS, without which none of the above is reachable from a browser.
await check("registry is CORS-open", "/.well-known/zakai-trust-registry.json", ({ headers }) =>
  headers.get("access-control-allow-origin") === "*" ? null : "missing CORS header");

// The Oracle must stay shut when unconfigured, rather than open.
{
  const res = await fetch(BASE + "/api/oracle/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ market: "IL", vertical: "arnona", counterparty: "x" }),
  });
  results.push({
    name: "Oracle API is closed when unconfigured",
    path: "/api/oracle/predict",
    ok: res.status === 503 || res.status === 401,
    problem: res.status === 503 || res.status === 401 ? null : `expected 503/401, got ${res.status}`,
  });
}

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`  ${r.ok ? "✓" : "✗"} ${r.name.padEnd(38)} ${r.problem ?? ""}`);
console.log(`\n${results.length - failed.length}/${results.length} passed\n`);
process.exit(failed.length ? 1 : 0);
