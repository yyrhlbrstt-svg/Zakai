#!/usr/bin/env node
/**
 * The pre-demo checklist, as a command rather than a document.
 *
 * WHY NOT A MARKDOWN CHECKLIST
 *
 * Because the demo that broke was demoed by somebody who believed it worked.
 * A list of things to remember is only as good as the memory of the person
 * under time pressure five minutes before showing their parents, and that is
 * exactly when a list gets skimmed. This answers the same questions by
 * looking, and it exits non-zero when an answer is wrong.
 *
 * It deliberately does NOT run the E2E suite itself — that needs a built
 * server and belongs in CI. What it does is tell you, in one screen, whether
 * the thing you are about to demo is the thing CI tested, whether errors are
 * being recorded, and which flags are on.
 *
 * Usage: node scripts/pre-demo-check.mjs [baseUrl]
 */

const base = (process.argv[2] || process.env.ZAKAI_DEMO_URL || "https://zakai-3uxj.vercel.app")
  .replace(/\/+$/, "");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const warn = (name, detail) => {
  results.push({ name, ok: true, warned: true });
  console.log(`warn ${name} — ${detail}`);
};

// 1. Is the thing reachable at all, and which commit is it?
let version = null;
try {
  const res = await fetch(`${base}/api/version`, { signal: AbortSignal.timeout(15000) });
  version = await res.json().catch(() => null);
  check("the URL you are about to demo responds", res.ok, `${base} → ${res.status}`);
} catch (e) {
  check("the URL you are about to demo responds", false, String(e).slice(0, 120));
}

// 2. Does it match the commit you think it does? The "Ready Stale" trap:
//    Vercel shows green while serving a build from three commits ago.
const localSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
if (version?.commit && localSha) {
  check(
    "the deployment is the commit you tested",
    version.commit.startsWith(localSha.slice(0, 7)),
    `serving ${version.commit}, expected ${localSha.slice(0, 7)}`,
  );
} else {
  warn("the deployment is the commit you tested", "no SHA to compare against — check the Vercel dashboard by eye");
}

// 3. Would an error during the demo be recorded anywhere?
try {
  const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(15000) });
  const health = await res.json().catch(() => null);
  if (health && typeof health.errorReporting === "boolean") {
    if (health.errorReporting) check("errors during the demo will be recorded", true);
    else warn("errors during the demo will be recorded", "error reporting is OFF — a crash will leave no trace");
  } else {
    warn("errors during the demo will be recorded", "health endpoint does not report it");
  }
  if (health && typeof health.flags === "object") {
    const on = Object.entries(health.flags).filter(([, v]) => v).map(([k]) => k);
    console.log(`     flags on: ${on.length ? on.join(", ") : "(none)"}`);
  }
} catch (e) {
  warn("errors during the demo will be recorded", String(e).slice(0, 100));
}

// 4. The three screens most likely to be opened, actually opening.
for (const path of ["/he", "/he/money", "/he/trust"]) {
  try {
    const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(20000) });
    check(`${path} loads`, res.ok, `${res.status}`);
  } catch (e) {
    check(`${path} loads`, false, String(e).slice(0, 100));
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pre-demo checks passed.`);
if (failed.length) {
  console.log("Do not demo this build until these are green.");
  process.exit(1);
}
console.log("Safe to demo. Still run `npm run verify:loop` if anything shipped since CI.");
