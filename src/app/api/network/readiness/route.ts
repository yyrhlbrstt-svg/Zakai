import { NextResponse } from "next/server";
import { emailConfigured, smsConfigured } from "@/lib/messaging";

export const dynamic = "force-dynamic";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=120, stale-while-revalidate=300",
};

/**
 * Non-secret deploy readiness for partners and agents. Never exposes env values.
 * Payment provider name only — not keys.
 */
export async function GET() {
  const paymentProvider = (process.env.PAYMENT_PROVIDER || "mock").toLowerCase();
  const paymentsLive = paymentProvider !== "mock" && Boolean(process.env.PAYPLUS_API_KEY);

  return NextResponse.json(
    {
      ok: true,
      updated: "2026-08-02",
      disclaimer: "Booleans only — no secrets. Consumer agent loops need SMTP for outbound mail.",
      layers: {
        database: Boolean(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL),
        mandateSigning: Boolean(process.env.MANDATE_SIGNING_JWK),
        cronProtected:
          process.env.NODE_ENV !== "production" || Boolean(process.env.CRON_SECRET?.trim()),
        emailOutbound: emailConfigured(),
        smsOutbound: smsConfigured(),
        paymentsLive,
        paymentProvider: paymentsLive ? paymentProvider : "mock",
        ai:
          Boolean(process.env.ANTHROPIC_API_KEY) ||
          Boolean(process.env.DEEPSEEK_API_KEY) ||
          Boolean(process.env.GEMINI_API_KEY) ||
          Boolean(process.env.OPENAI_COMPAT_API_KEY),
        oracleApi: Boolean(process.env.ORACLE_API_KEY || process.env.ZAKAI_ORACLE_API_KEY),
      },
      urls: {
        opportunity_map: "/api/network/opportunity-map",
        mandate_verify: "/api/mandate/verify",
        integrations: "/en/integrations",
        network_proof: "/en/network-proof",
      },
    },
    { headers: cors },
  );
}
