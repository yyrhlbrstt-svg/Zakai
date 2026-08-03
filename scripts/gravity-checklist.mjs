#!/usr/bin/env node
/**
 * Founder gravity checklist — probes production for A/B/C gates.
 * Never invents institutions or scores; prints next human action.
 *
 *   node scripts/gravity-checklist.mjs
 *   node scripts/gravity-checklist.mjs https://zakai-3uxj.vercel.app
 */
const base = (process.argv[2] || process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app").replace(
  /\/+$/,
  "",
);

async function getJson(path) {
  const res = await fetch(`${base}${path}`, { redirect: "follow" });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* plain */
  }
  return { status: res.status, json, text };
}

function line(ok, label, detail) {
  console.log(`${ok ? "OK  " : "NEED"} ${label}${detail ? ` — ${detail}` : ""}`);
}

console.log(`Gravity checklist @ ${base}\n`);

const join = await getJson("/api/network/join-kit");
line(join.status === 200, "Join kit", join.status === 200 ? "adoptability JSON live" : `HTTP ${join.status}`);

const packs = await getJson("/api/cdn/packs/manifest.json");
const markets = packs.json?.markets?.length ?? 0;
line(packs.status === 200 && markets >= 2, "Packs origin mirror", `markets=${markets}`);

const evidence = await getJson("/api/mandate/delegation/evidence");
line(evidence.status === 200, "Issuer evidence package", evidence.status === 200 ? "dry-run ready" : `HTTP ${evidence.status}`);

const inbound = await getJson("/api/institution/inbound-receive");
line(inbound.status === 200, "Inbound receive reference", `HTTP ${inbound.status}`);

const fairness = await getJson("/api/fairness/certified?market=IL");
const certified = fairness.json?.certified_providers?.length ?? 0;
line(true, "Fairness Certified API", `status=${fairness.json?.status ?? "?"} providers=${certified}`);

const gates = await getJson("/api/network/trillion-gates");
if (gates.json?.phase) {
  const passed = gates.json.gatesPassed ?? gates.json.gates?.filter((g) => g.passed).length;
  line(true, "Control phase", `${gates.json.phase} (${passed}/${gates.json.gatesTotal ?? 9})`);
  console.log(`     nextBlocker: ${gates.json.nextBlocker ?? "(none)"}`);
  for (const g of gates.json.gates ?? []) {
    line(!!g.passed, g.id, g.passed ? g.evidence : g.requirement);
  }
} else {
  line(false, "trillion-gates", `HTTP ${gates.status}`);
}

console.log(`
Human unlocks (code cannot fake these):
  G3  One institution completes ${base}/he/institutions/leader and opts into leaders.
  G5  Admit second issuer after POST ${base}/api/mandate/delegation/evidence dry-run.
  G2* Push zakai-packs export to standalone GitHub/CDN; set ZML_PACKS_CDN.
  G4+ Real case→outcome volume; then phase D (PayPlus/SMTP) only after gravity.

Kit page: ${base}/he/join-network
`);
