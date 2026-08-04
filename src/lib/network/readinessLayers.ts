import "server-only";

import { emailConfigured, smsConfigured } from "@/lib/messaging";
import { readinessOperationalScore, readinessTier } from "./readinessScore";
import { evaluateConsumerReleaseGate, paymentsFullyLive } from "@/lib/deploy/releaseGate";

export function buildReadinessSnapshot() {
  const paymentsLive = paymentsFullyLive();

  const layers = {
    database: Boolean(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL),
    mandateSigning: Boolean(process.env.MANDATE_SIGNING_JWK),
    cronProtected:
      process.env.NODE_ENV !== "production" || Boolean(process.env.CRON_SECRET?.trim()),
    emailOutbound: emailConfigured(),
    smsOutbound: smsConfigured(),
    paymentsLive,
    ai:
      Boolean(process.env.ANTHROPIC_API_KEY) ||
      Boolean(process.env.DEEPSEEK_API_KEY) ||
      Boolean(process.env.GEMINI_API_KEY) ||
      Boolean(process.env.OPENAI_COMPAT_API_KEY),
    oracleApi: Boolean(process.env.ORACLE_API_KEY || process.env.ZAKAI_ORACLE_API_KEY),
  };

  const operationalScore = readinessOperationalScore(layers);
  const release = evaluateConsumerReleaseGate();

  return {
    layers,
    paymentsMode: paymentsLive ? "live" : "demo",
    operationalScore,
    tier: readinessTier(operationalScore),
    consumerReleaseScore: release.releaseScore,
    canReleaseConsumerApp: release.canReleaseConsumerApp,
  };
}
