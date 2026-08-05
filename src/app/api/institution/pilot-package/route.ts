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

  const curlAccept = sample
    ? [
        `curl -sS -X POST ${origin}/api/pipe/accept \\`,
        `  -H 'Content-Type: application/json' \\`,
        `  -d '{"mandate_jws":"${sample.token}","action":"request:records"}'`,
      ].join("\n")
    : [
        `curl -sS -X POST ${origin}/api/pipe/accept \\`,
        `  -H 'Content-Type: application/json' \\`,
        `  -d '{"mandate_jws":"<compact-jws>","action":"request:records"}'`,
      ].join("\n");

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
        title: "One-shot pipe accept (preferred)",
        action: `POST ${origin}/api/pipe/accept with mandate_jws + action`,
      },
      {
        id: 2,
        title: "Publish acceptor mark when you process Mandates",
        action: `GET ${origin}/api/pipe/mark`,
      },
      {
        id: 3,
        title: sample
          ? "POST the filled pipe/accept curl below (live Mandate JWS, expires in 1h)"
          : "POST pipe/accept — signing keys unavailable here; set Mandate keys then re-fetch",
        action: `POST ${origin}/api/pipe/accept`,
      },
      {
        id: 4,
        title: "Optional: hosted reference inbound-receive (multi-field body)",
        action: `POST ${origin}/api/institution/inbound-receive`,
      },
      {
        id: 5,
        title: "Machine readiness (vectors + Status List)",
        action: `${origin}/api/mandate/ready`,
      },
      {
        id: 6,
        title: "Human quickstart → Pioneer wizard only after READY",
        action: `${origin}/he/institutions/quickstart`,
      },
      {
        id: 7,
        title: "Clone receiver for your VPC",
        action: `${origin}/reference/inbound-receiver/receive.mjs`,
      },
      {
        id: 8,
        title: "Optional: list on leaders wall (wizard opt-in only)",
        action: `${origin}/he/institutions/leaders`,
      },
    ],
    curl_health: `curl -sS ${origin}/api/pipe | jq .`,
    curl_accept: curlAccept,
    curl_inbound: curlInbound,
    curl_inbound_template: curlInbound,
    sample: sample
      ? {
          audience: sample.audience,
          mandate_jti: sample.jti,
          mandate_jws: sample.token,
          statusIndex: sample.statusIndex,
          note: "Demo only — not a live consumer claim. Embeds zkm.status for offline revoke. Re-fetch for a fresh token.",
        }
      : null,
    urls: {
      pipe: `${origin}/.well-known/zakai-pipe.json`,
      pipe_accept: `${origin}/api/pipe/accept`,
      pipe_mark: `${origin}/api/pipe/mark`,
      inbound_spec: `${origin}/.well-known/zakai-inbound-receive.json`,
      jwks: `${origin}/.well-known/zakai-jwks.json`,
      trust_registry: `${origin}/.well-known/zakai-trust-registry.json`,
      join_kit: `${origin}/api/network/join-kit`,
      ready: `${origin}/api/mandate/ready`,
      quickstart: `${origin}/he/institutions/quickstart`,
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
