#!/usr/bin/env node
/**
 * Walk the money loop from signup to a Fee, and fail if it cannot complete.
 *
 * WHY THIS IS THE MOST IMPORTANT CHECK IN THE REPOSITORY
 *
 * Nobody has ever seen this loop finish. Not because it is broken — because
 * without SMTP the ownership code is never delivered, so no case can reach
 * SENT, so `recordSaving` refuses with NOT_SENT, so no SavingsProof and no Fee
 * have ever existed. Every test, every sweep and every browser check in this
 * repository stops short of that wall.
 *
 * `verify-loop.mjs` covers what a person can do in a browser. This covers what
 * the product is *for*: detect, act, prove, charge. It reads the ownership code
 * out of the Outbox row — which is where an undelivered message sits — so the
 * whole path can be proven without a mail server, exactly once, before the
 * first real user depends on it.
 *
 * If this passes, the only thing standing between Zakai and revenue is
 * credentials. If it fails, the credentials would not have helped.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/verify-money-loop.mjs [baseUrl]
 */

import { PrismaClient } from "@prisma/client";

const base = (process.argv[2] || process.env.ZAKAI_URL || "http://127.0.0.1:3000").replace(
  /\/+$/,
  "",
);

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

try {
  const probe = await fetch(`${base}/api/protocol`);
  if (!probe.ok) throw new Error(`status ${probe.status}`);
} catch (e) {
  console.log(`SKIP verify-money-loop: no server at ${base} (${e.message}).`);
  process.exit(0);
}

const prisma = new PrismaClient();
let cookie = "";
const email = `loop${Date.now()}@example.com`;

async function api(path, body, method = "POST") {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

try {
  // ---- 1. A person exists ---------------------------------------------------
  const signup = await api("/api/auth/signup", {
    name: "בודק לולאה",
    email,
    phone: "0501234599",
    password: "LoopCheck12345!",
    country: "IL",
    acceptedTerms: true,
  });
  if (!check("a person can sign up", signup.status === 200 || signup.status === 201, `status ${signup.status}`)) {
    throw new Error(JSON.stringify(signup.json).slice(0, 200));
  }

  // ---- 2. A case exists -----------------------------------------------------
  const analyze = await api("/api/cases/analyze", {
    mode: "manual",
    provider: "cellcom",
    amountShekels: 129,
    plan: "חבילה סלולרית",
    providerContactEmail: "service@example.com",
    locale: "he",
  });
  const caseId = analyze.json.caseId;
  if (!check("a case opens with a recommendation", Boolean(caseId), `status ${analyze.status}`)) {
    throw new Error(JSON.stringify(analyze.json).slice(0, 200));
  }

  // ---- 3. The person approves ----------------------------------------------
  const approve = await api(`/api/cases/${caseId}/approve`, {
    counterpartyEmail: "service@example.com",
  });
  check("the person's approval is recorded", approve.status === 200, `status ${approve.status}`);

  // ---- 4. Ownership: the wall everything has always stopped at --------------
  const sendCode = await api(`/api/cases/${caseId}/ownership/send`, {});
  check("an ownership code is issued", sendCode.status === 200, `status ${sendCode.status}`);

  /**
   * Read the code out of the queued message.
   *
   * This is the only step that reaches past the HTTP surface, and it is
   * reaching for exactly the thing SMTP would have delivered. It proves the
   * code was generated and addressed correctly; it does not pretend a mail
   * server exists.
   */
  const queuedAll = await prisma.outbox.findMany({
    where: { caseId },
    orderBy: { createdAt: "desc" },
  });
  /**
   * Two paths are generated, not one, and that is the point: the SMS carries a
   * six-digit code and the email carries a magic link, so a person with no
   * phone reception and a person with no SMS gateway both have a way through.
   * A first version of this looked only at the newest row, found the email,
   * and declared the code missing — the check was wrong, not the product.
   */
  const smsRow = queuedAll.find((r) => /\b\d{6}\b/.test(r.body || ""));
  const linkRow = queuedAll.find((r) => /ownership\/confirm\?token=/.test(r.body || ""));
  check(
    "both ways through are prepared: a code and a magic link",
    Boolean(smsRow) && Boolean(linkRow),
    `${queuedAll.length} queued message(s)`,
  );

  const code = smsRow?.body?.match(/\b(\d{6})\b/)?.[1];
  if (!check("the code is really in the message we would have sent", Boolean(code), smsRow ? `channel ${smsRow.channel}, status ${smsRow.status}` : "no message carried one")) {
    throw new Error("no verification code found in any queued message");
  }

  const verify = await api(`/api/cases/${caseId}/ownership/verify`, { code });
  if (!check("ownership verifies", verify.status === 200, `status ${verify.status}`)) {
    throw new Error(JSON.stringify(verify.json).slice(0, 200));
  }

  // ---- 5. The letter goes out ----------------------------------------------
  const send = await api(`/api/cases/${caseId}/send`, {});
  if (!check("the case reaches SENT", send.status === 200, `status ${send.status}`)) {
    throw new Error(JSON.stringify(send.json).slice(0, 200));
  }
  const afterSend = await prisma.case.findUnique({ where: { id: caseId } });
  check("SENT is what the database says too", afterSend?.status === "SENT", `status ${afterSend?.status}`);

  // ---- 6. Money comes back, and is proved -----------------------------------
  const saved = await api(`/api/cases/${caseId}/record-saving`, { newAmountShekels: 89 });
  if (!check("a saving can be recorded", saved.status === 200, `status ${saved.status}`)) {
    throw new Error(JSON.stringify(saved.json).slice(0, 200));
  }

  const proof = await prisma.savingsProof.findFirst({ where: { caseId } });
  check(
    "a SavingsProof exists — the first one this product has ever produced",
    Boolean(proof),
    proof ? `saving ${proof.savingMonthly} agorot/month` : "",
  );

  const fee = await prisma.fee.findUnique({ where: { caseId } });
  check(
    "a Fee exists, in integer agorot",
    Boolean(fee) && Number.isInteger(fee.amount),
    fee ? `${fee.amount} agorot at ${fee.rateBps}bps, status ${fee.status}` : "",
  );
} catch (err) {
  console.log(`\nstopped: ${String(err.message || err).slice(0, 300)}`);
} finally {
  // Leave nothing behind. A verification script that pollutes the database it
  // verifies makes the next run's evidence worse.
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
  } catch {
    /* cleanup is best effort */
  }
  await prisma.$disconnect();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} steps completed.`);
if (failed || results.length < 10) process.exitCode = 1;
