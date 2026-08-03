import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { issueInstitutionPilotSample } from "@/lib/mandate/demoVerifierReadiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-sitting institution pilot kit: URLs + curl + optional live sample JWS.
 * Does not list anyone as a Reference Verifier.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin.replace(/\/+$/, "");
  const audience = (url.searchParams.get("audience") || "bank-pilot-demo").trim().toLowerCase();
  const receiverPath = join(process.cwd(), "public/reference/inbound-receiver/receive.mjs");
  const receiveMjs = existsSync(receiverPath) ? readFileSync(receiverPath, "utf8") : null;

  const sample = await issueInstitutionPilotSample(audience);

  const curlInbound = sample
    ? [
        `curl -sS -X POST ${origin}/api/institution/inbound-receive \\`,
        `  -H 'Content-Type: application/json' \\`,
        `  -H 'Idempotency-Key: ${sample.jti}' \\`,
        `  -d '{"mandate_jws":"${sample.token}","mandate_jti":"${sample.jti}","intent":"information_request","vertical":"banking","locale":"he-IL"}'`,
      ].join("\n")
    : [
        `curl -sS -X POST ${origin}/api/institution/inbound-receive \\`,
        `  -H 'Content-Type: application/json' \\`,
        `  -H 'Idempotency-Key: <mandate_jti>' \\`,
        `  -d '{"mandate_jws":"<compact-jws>","mandate_jti":"<jti>","intent":"information_request","vertical":"banking","locale":"he-IL"}'`,
      ].join("\n");

  const body = {
    spec: "zakai-institution-pilot-package",
    version: "2026-08-03",
    honesty:
      "This package helps a bank finish inbound verify in one sitting. Leaders wall listing still requires the wizard opt-in — never auto-filled.",
    steps: [
      {
        id: 1,
        title: "Hit the hosted reference receiver",
        action: `GET ${origin}/api/institution/inbound-receive`,
      },
      {
        id: 2,
        title: "Run readiness wizard",
        action: `${origin}/he/institutions/leader`,
      },
      {
        id: 3,
        title: sample
          ? "POST the filled sample curl below (live Mandate JWS, expires in 1h)"
          : "POST inbound body — signing keys unavailable in this environment; use wizard sample after keys are set",
        action: `POST ${origin}/api/institution/inbound-receive`,
      },
      {
        id: 4,
        title: "Clone receiver for your VPC",
        action: `${origin}/reference/inbound-receiver/receive.mjs`,
      },
      {
        id: 5,
        title: "Optional: list on leaders wall",
        action: `${origin}/he/institutions/leaders`,
      },
    ],
    curl_health: `curl -sS ${origin}/api/institution/inbound-receive | jq .`,
    curl_inbound: curlInbound,
    curl_inbound_template: curlInbound,
    sample: sample
      ? {
          audience: sample.audience,
          mandate_jti: sample.jti,
          mandate_jws: sample.token,
          note: "Demo only — not a live consumer claim. Re-fetch this package for a fresh token.",
        }
      : null,
    urls: {
      inbound_spec: `${origin}/.well-known/zakai-inbound-receive.json`,
      jwks: `${origin}/.well-known/zakai-jwks.json`,
      trust_registry: `${origin}/.well-known/zakai-trust-registry.json`,
      join_kit: `${origin}/api/network/join-kit`,
      wizard: `${origin}/he/institutions/leader`,
      clone_dir: `${origin}/reference/inbound-receiver/`,
      ignore_cost: `${origin}/api/institution/ignore-cost`,
      outreach_kit: `${origin}/api/institution/outreach-kit`,
      sample_for_audience: `${origin}/api/institution/pilot-package?audience=YOUR_AUD`,
    },
    receive_mjs: receiveMjs,
  };

  return NextResponse.json(body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
