import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { cacheControlHeader } from "@/lib/scale/publicCache";

export const runtime = "nodejs";
export const revalidate = 300;

/**
 * One-sitting institution pilot kit: URLs + curl + cloneable receiver source.
 * Does not list anyone as a Reference Verifier.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin.replace(/\/+$/, "");
  const receiverPath = join(process.cwd(), "public/reference/inbound-receiver/receive.mjs");
  const receiveMjs = existsSync(receiverPath)
    ? readFileSync(receiverPath, "utf8")
    : null;

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
        title: "POST a sample inbound body (after you have a Mandate JWS)",
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
    curl_inbound_template: [
      `curl -sS -X POST ${origin}/api/institution/inbound-receive \\`,
      `  -H 'Content-Type: application/json' \\`,
      `  -H 'Idempotency-Key: <mandate_jti>' \\`,
      `  -d '{"mandate_jws":"<compact-jws>","mandate_jti":"<jti>","intent":"information_request","vertical":"banking","locale":"he-IL"}'`,
    ].join("\n"),
    urls: {
      inbound_spec: `${origin}/.well-known/zakai-inbound-receive.json`,
      jwks: `${origin}/.well-known/zakai-jwks.json`,
      trust_registry: `${origin}/.well-known/zakai-trust-registry.json`,
      join_kit: `${origin}/api/network/join-kit`,
      wizard: `${origin}/he/institutions/leader`,
      clone_dir: `${origin}/reference/inbound-receiver/`,
      ignore_cost: `${origin}/api/institution/ignore-cost`,
    },
    receive_mjs: receiveMjs,
  };

  return NextResponse.json(body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": cacheControlHeader("catalog"),
    },
  });
}
