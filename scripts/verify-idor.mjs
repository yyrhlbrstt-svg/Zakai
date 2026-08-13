#!/usr/bin/env node
/**
 * Can somebody touch a case that is not theirs?
 *
 * WHY A PROBE AND NOT A CODE REVIEW
 *
 * Reading thirty-eight route files and confirming each one compares
 * `kase.userId` to the session is exactly the kind of review that passes
 * while being wrong. The check can be present and unreachable, present after
 * a mutation, present on the case but not on the nested object, or present in
 * a helper that a later refactor stopped calling. Every one of those reads as
 * correct in a diff.
 *
 * So this does not read the code. It creates two real accounts, gives the
 * first one a real case, and then — as the second account, with a valid
 * session of its own — calls every case-scoped endpoint with the first
 * account's case id. Anything that is not a 401/403/404 is a finding, and the
 * finding is a fact rather than an opinion about a file.
 *
 * WHAT COUNTS AS A PASS
 *
 * 404 is the right answer, not 403. Telling a stranger "this case exists but
 * is not yours" leaks that the id is real, which is half of what an attacker
 * enumerating ids is trying to learn. Both are accepted here — refusing is the
 * security property — but a route answering 403 is reported so the difference
 * is a decision somebody made rather than an accident.
 *
 * A 500 is also a finding. It means the request got past the ownership gate
 * far enough to break on something else, and "it crashed instead of letting
 * you in" is not an access control.
 *
 * Usage:
 *   node scripts/verify-idor.mjs [baseUrl]
 */

const base = (process.argv[2] || process.env.ZAKAI_URL || "http://127.0.0.1:3000").replace(
  /\/+$/,
  "",
);

try {
  const probe = await fetch(`${base}/api/protocol`);
  if (!probe.ok) throw new Error(`status ${probe.status}`);
} catch (e) {
  console.log(`SKIP verify-idor: no server at ${base} (${e.message}).`);
  process.exit(0);
}

/**
 * Every route that takes a case id, with a body its schema accepts.
 *
 * The bodies are not decoration. The first run of this probe sent whatever
 * field name came to mind and got four 400s, which it duly reported as
 * findings. They were not findings — validation ran before the ownership
 * check, so the probe never reached the thing it was testing and would have
 * reported the same four "failures" against a perfectly scoped route.
 *
 * A payload the schema rejects tests the schema. Only a payload it accepts
 * tests who is allowed through.
 */
const CASE_ROUTES = [
  ["POST", "/api/cases/:id/approve", { counterpartyEmail: "x@example.com" }],
  ["POST", "/api/cases/:id/authorization", undefined],
  ["POST", "/api/cases/:id/dispatch", {}],
  ["POST", "/api/cases/:id/send", {}],
  ["POST", "/api/cases/:id/ownership/send", undefined],
  ["POST", "/api/cases/:id/ownership/verify", { code: "000000" }],
  ["POST", "/api/cases/:id/follow-up", { replyKind: "delay" }],
  ["POST", "/api/cases/:id/propose-saving", { text: "הספק אישר הנחה של 30 שקל לחודש." }],
  ["POST", "/api/cases/:id/record-saving", { newAmountShekels: 1 }],
  ["GET", "/api/cases/:id/settlement", undefined],
  ["POST", "/api/cases/:id/fee/checkout", {}],
  ["POST", "/api/cases/:id/promised-credit", { promisedShekels: 30 }],
  ["GET", "/api/cases/:id/promised-credit", undefined],
  ["POST", "/api/cases/:id/promised-credit/check", { observedShekels: 0 }],
];

async function call(path, { method = "POST", body, cookie } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get("set-cookie");
  const text = await res.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON body is itself worth seeing in the detail line */
  }
  return { status: res.status, json, text, cookie: setCookie?.split(";")[0] };
}

async function signUp(tag) {
  const email = `idor-${tag}-${Date.now()}@example.com`;
  const res = await call("/api/auth/signup", {
    body: {
      name: `IDOR ${tag}`,
      email,
      phone: "05012345" + String(Math.floor(10 + Math.random() * 89)),
      password: "IdorProbe12345!",
      country: "IL",
    },
  });
  if (!res.cookie) throw new Error(`signup failed for ${tag}: ${res.status} ${res.text.slice(0, 120)}`);
  return { email, cookie: res.cookie };
}

const findings = [];
const notes = [];

const victim = await signUp("victim");
const attacker = await signUp("attacker");

// A real case, opened the way the product opens one.
const analyze = await call("/api/cases/analyze", {
  cookie: victim.cookie,
  body: {
    mode: "manual",
    provider: "cellcom",
    amountShekels: 99,
    plan: "בדיקת IDOR",
    locale: "he",
  },
});
const caseId = analyze.json?.caseId ?? analyze.json?.case?.id;
if (!caseId) {
  console.log(`FAIL could not open a case to attack — ${analyze.status} ${analyze.text.slice(0, 200)}`);
  process.exit(1);
}
console.log(`victim case: ${caseId}\n`);

for (const [method, template, body] of CASE_ROUTES) {
  const path = template.replace(":id", caseId);

  // 1. The attacker, holding a valid session that is not the owner's.
  const asAttacker = await call(path, { method, body, cookie: attacker.cookie });
  const refused = asAttacker.status === 404 || asAttacker.status === 403;
  if (!refused) {
    findings.push(
      `${method} ${template} — a signed-in stranger got ${asAttacker.status}: ${asAttacker.text.slice(0, 140)}`,
    );
  } else if (asAttacker.status === 403) {
    notes.push(`${method} ${template} answers 403, confirming the id exists (404 leaks less)`);
  }

  // 2. Nobody at all. A missing session must never be the same as a valid one.
  const asStranger = await call(path, { method, body });
  if (asStranger.status !== 401 && asStranger.status !== 403 && asStranger.status !== 404) {
    findings.push(
      `${method} ${template} — no session at all got ${asStranger.status}: ${asStranger.text.slice(0, 140)}`,
    );
  }

  const mark = refused ? "ok  " : "FAIL";
  console.log(`${mark} ${method.padEnd(4)} ${template.padEnd(42)} attacker=${asAttacker.status} anon=${asStranger.status}`);
}

// The owner must still be able to use their own case — a probe that passes
// because everything is broken for everybody has proven nothing.
const ownerCheck = await call(`/api/cases/${caseId}/authorization`, { cookie: victim.cookie });
const ownerOk = ownerCheck.status === 200;
console.log(`\n${ownerOk ? "ok  " : "FAIL"} the owner can still act on their own case (${ownerCheck.status})`);
if (!ownerOk) {
  findings.push(
    `the owner was refused their own case (${ownerCheck.status}) — this probe proves nothing until that works`,
  );
}

if (notes.length) {
  console.log("\nNotes:");
  for (const n of notes) console.log(`  · ${n}`);
}

if (findings.length) {
  console.log(`\n${findings.length} finding(s):`);
  for (const f of findings) console.log(`  ✗ ${f}`);
} else {
  console.log(`\nNo case-scoped route let a stranger in.`);
}

process.exit(findings.length === 0 ? 0 : 1);
