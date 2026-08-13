#!/usr/bin/env node
/**
 * Walk the whole authority handshake the way an outside agent would, and fail
 * if any of it is untrue.
 *
 * WHY THIS EXISTS RATHER THAN A PARAGRAPH IN A README
 *
 * The claim is that a stranger can integrate with Zakai's authority layer
 * without talking to anybody. That claim is either mechanically true or it is
 * marketing, and the only difference is whether something checks it.
 *
 * Everything here uses the public endpoints and nothing else — no imports from
 * src/, no database access, no test helper. If this passes, an integrator with
 * curl can do exactly the same thing.
 *
 * Usage:
 *   node scripts/verify-agent-authorization.mjs [baseUrl]
 *
 * Needs a running server. Approval of the demo agent and the human's tap are
 * the two steps a script cannot perform, and both are reported as SKIP rather
 * than quietly passed — a check that fakes the human is checking nothing.
 */

const base = (process.argv[2] || process.env.ZAKAI_URL || "http://127.0.0.1:3000").replace(
  /\/+$/,
  "",
);

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}
function skip(name, why) {
  console.log(`SKIP ${name} — ${why}`);
}

async function post(path, body) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

try {
  const probe = await fetch(`${base}/api/protocol`);
  if (!probe.ok) throw new Error(`status ${probe.status}`);
} catch (e) {
  console.log(`SKIP verify-agent-authorization: no server at ${base} (${e.message}).`);
  process.exit(0);
}

// ---- 1. Discovery -----------------------------------------------------------
const discoveryRes = await fetch(`${base}/.well-known/zakai-agent-authorization.json`);
const discovery = await discoveryRes.json().catch(() => ({}));
check("the flow is discoverable without asking anyone", discoveryRes.ok && discovery.spec === "zakai-agent-authorization");
check(
  "discovery names the scopes and the ones that will never exist",
  Array.isArray(discovery.scopes) && discovery.scopes.length > 0 && Array.isArray(discovery.never?.scopes),
);

// ---- 2. Registration --------------------------------------------------------
const slug = `probe-${Date.now().toString(36)}`;
const redirect = "http://localhost:8080/cb";
const reg = await post("/api/agent/register", {
  slug,
  name: "Integration Probe",
  description: "Checks that a stranger can integrate.",
  contact: "probe@example.com",
  redirect_uris: [redirect],
});
check("an agent can register itself", reg.status === 201 && reg.json.agent === slug);
check(
  "registration says out loud that it is not yet allowed to ask",
  reg.json.status === "pending" && typeof reg.json.note === "string" && reg.json.note.length > 20,
);

const dup = await post("/api/agent/register", {
  slug,
  name: "Impostor",
  contact: "someone@example.com",
  redirect_uris: [redirect],
});
check("a taken slug cannot be claimed twice", dup.status === 409);

const insecure = await post("/api/agent/register", {
  slug: `${slug}-x`,
  name: "Cleartext",
  contact: "probe@example.com",
  redirect_uris: ["http://elsewhere.example/cb"],
});
check("a cleartext redirect is refused at registration", insecure.status === 400);

// ---- 3. The refusals that make the grant worth having -----------------------
const pendingAsk = await post("/api/agent/authorize", {
  agent: slug,
  scopes: ["read:transactions"],
  purpose: "Checking that an unapproved agent cannot ask.",
  redirect_uri: redirect,
});
check(
  "an unapproved agent cannot ask a person for anything",
  pendingAsk.status === 400 && pendingAsk.json.error === "agent_not_approved",
);

const approvedAgent = process.env.ZAKAI_DEMO_AGENT;
if (!approvedAgent) {
  skip(
    "forbidden scopes and unregistered redirects are refused",
    "needs an approved agent; set ZAKAI_DEMO_AGENT to one",
  );
  skip("a person can approve and the agent receives a mandate", "needs a human and an approved agent");
} else {
  const forbidden = await post("/api/agent/authorize", {
    agent: approvedAgent,
    scopes: ["read:transactions", "payment:transfer"],
    purpose: "Checking that money movement cannot be requested.",
    redirect_uri: process.env.ZAKAI_DEMO_REDIRECT || redirect,
  });
  check(
    "money-moving scopes are refused, not merely unlisted",
    forbidden.status === 400 && forbidden.json.error === "forbidden_scope",
  );

  const stolen = await post("/api/agent/authorize", {
    agent: approvedAgent,
    scopes: ["read:transactions"],
    purpose: "Checking that the grant cannot be steered elsewhere.",
    redirect_uri: "https://evil.test/cb",
  });
  check(
    "a grant cannot be steered to an unregistered address",
    stolen.status === 400 && stolen.json.error === "redirect_not_registered",
  );

  const ask = await post("/api/agent/authorize", {
    agent: approvedAgent,
    scopes: ["read:transactions"],
    purpose: "A real ask, to check the URL handed back is for the person.",
    redirect_uri: process.env.ZAKAI_DEMO_REDIRECT || redirect,
  });
  check(
    "asking returns a URL for the person and nothing else",
    ask.status === 200 &&
      typeof ask.json.authorize_url === "string" &&
      !("mandate" in ask.json) &&
      !("token" in ask.json),
  );

  const badCode = await post("/api/agent/token", { agent: approvedAgent, code: "not-a-real-code" });
  check(
    "an invented code is refused, and says nothing else",
    badCode.status === 400 && badCode.json.error === "invalid_code",
  );

  skip("a person approves and the agent receives the mandate", "requires a human to tap approve");
}

// ---- 4. Verification is possible without us ---------------------------------
const jwks = await fetch(`${base}/.well-known/zakai-jwks.json`);
const jwksBody = await jwks.json().catch(() => ({}));
check(
  "anyone can verify a mandate offline: the JWKS is public",
  jwks.ok && Array.isArray(jwksBody.keys) && jwksBody.keys.length > 0,
);

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
if (failed) process.exitCode = 1;
