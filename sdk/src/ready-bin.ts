#!/usr/bin/env node
/**
 * Institution readiness gate — run authorization test vectors + verify the
 * signed status list. Exit 0 only when both pass.
 *
 *   npx zakai-mandate-ready
 *   npx zakai-mandate-ready --origin https://zakai-3uxj.vercel.app
 *
 * Passing this is the machine signal before claiming Pioneer on
 * /institutions/leader — not regulatory certification.
 */

import { decide, type DecisionRequest } from "./decision.js";
import type { MandateClaims } from "./mandate.js";
import { verifyStatusListFromUrl } from "./statusList.js";

const DEFAULT_ORIGIN = "https://zakai-3uxj.vercel.app";

function argOrigin(): string {
  const i = process.argv.indexOf("--origin");
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]!.replace(/\/$/, "");
  return (process.env.ZAKAI_BASE_URL || DEFAULT_ORIGIN).replace(/\/$/, "");
}

async function runVectors(origin: string): Promise<{ total: number; failed: string[] }> {
  const res = await fetch(`${origin}/api/mandate/test-vectors`);
  if (!res.ok) throw new Error(`test-vectors HTTP ${res.status}`);
  const doc = (await res.json()) as {
    evaluated_at_unix: number;
    vectors: Array<{
      id: string;
      claims: MandateClaims;
      action: string;
      audience: string;
      subject?: string;
      market?: string;
      revocation?: DecisionRequest["revocation"];
      act_confirmation?: string;
      expect: { decision: string; reason?: string | null };
      pins?: string;
    }>;
  };
  const now = new Date(doc.evaluated_at_unix * 1000);
  const failed: string[] = [];
  for (const v of doc.vectors) {
    const result = decide({
      claims: v.claims,
      action: v.action,
      audience: v.audience,
      subject: v.subject,
      market: v.market,
      revocation: v.revocation ?? "unknown",
      actConfirmation: v.act_confirmation,
      now,
    });
    const expected =
      v.expect.reason != null && v.expect.reason !== ""
        ? `${v.expect.decision}:${v.expect.reason}`
        : v.expect.decision;
    const got =
      result.decision === "deny" && result.reason
        ? `deny:${result.reason}`
        : result.decision;
    if (got !== expected) {
      failed.push(`${v.id}: expected ${expected}, got ${got}`);
    }
  }
  return { total: doc.vectors.length, failed };
}

async function main() {
  const origin = argOrigin();
  console.log(`Zakai Mandate readiness — ${origin}\n`);

  const { total, failed } = await runVectors(origin);
  if (failed.length === 0) {
    console.log(`authorization vectors: CONFORMANT — ${total}/${total} passed.`);
  } else {
    console.log(`authorization vectors: FAILED — ${total - failed.length}/${total} passed.`);
    for (const f of failed) console.log(`  ${f}`);
  }

  let statusOk = false;
  try {
    const verified = await verifyStatusListFromUrl({
      statusListUri: `${origin}/api/mandate/revocations`,
      issuer: origin,
      jwksUri: `${origin}/.well-known/zakai-jwks.json`,
    });
    statusOk = true;
    console.log(
      `status list: VERIFIED — iss=${verified.claims.iss} exp=${verified.claims.exp} (cacheable offline).`,
    );
  } catch (err) {
    console.log(`status list: FAILED — ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log("");
  if (failed.length === 0 && statusOk) {
    console.log("READY_FOR_PIONEER");
    console.log(`Next: open ${origin}/he/institutions/leader — finish the wizard and opt in.`);
    console.log("Passing vectors ≠ regulatory certification. Empty Pioneer wall until real opt-ins.");
    process.exit(0);
  }

  console.log("NOT_READY — fix failures above before claiming Pioneer.");
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
