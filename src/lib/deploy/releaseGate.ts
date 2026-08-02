export type ReleaseCheckLevel = "blocking" | "consumer" | "optional";

export type ReleaseCheck = {
  id: string;
  level: ReleaseCheckLevel;
  ok: boolean;
  /** Why this matters — safe to show in founder UI */
  cost: string;
  /** Env key(s) to set — never includes values */
  envKeys: string[];
};

function envSet(key: string, alts: string[] = []): boolean {
  if (process.env[key]?.trim()) return true;
  return alts.some((k) => Boolean(process.env[k]?.trim()));
}

/** Real PayPlus (or future PSP) — not mock, not half-configured. */
export function paymentsFullyLive(): boolean {
  const name = (process.env.PAYMENT_PROVIDER || "mock").toLowerCase();
  if (name === "mock") return false;
  if (name === "payplus") {
    return (
      envSet("PAYPLUS_API_KEY") &&
      envSet("PAYPLUS_SECRET_KEY") &&
      envSet("PAYPLUS_PAYMENT_PAGE_UID")
    );
  }
  return false;
}

function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim(),
  );
}

function aiConfigured(): boolean {
  return envSet("ANTHROPIC_API_KEY", [
    "DEEPSEEK_API_KEY",
    "GEMINI_API_KEY",
    "OPENAI_COMPAT_API_KEY",
  ]);
}

/**
 * Every check that must pass before a honest "consumer app release".
 * Optional items (Play TWA, Oracle API) are excluded from the score.
 */
export function evaluateConsumerReleaseGate(): {
  checks: ReleaseCheck[];
  releaseScore: number;
  canReleaseConsumerApp: boolean;
  failingIds: string[];
} {
  const checks: ReleaseCheck[] = [
    {
      id: "database",
      level: "blocking",
      ok: envSet("DATABASE_URL", ["NEON_DATABASE_URL"]),
      cost: "No database — users, cases, mandates and ledger are dead.",
      envKeys: ["NEON_DATABASE_URL", "DATABASE_URL"],
    },
    {
      id: "auth_secret",
      level: "blocking",
      ok: envSet("AUTH_SECRET"),
      cost: "Sessions cannot be signed — nobody stays logged in.",
      envKeys: ["AUTH_SECRET"],
    },
    {
      id: "mandate_signing_jwk",
      level: "blocking",
      ok: envSet("MANDATE_SIGNING_JWK"),
      cost: "Trust layer inert — mandates cannot be signed.",
      envKeys: ["MANDATE_SIGNING_JWK"],
    },
    {
      id: "mandate_signing_kid",
      level: "blocking",
      ok: envSet("MANDATE_SIGNING_KID"),
      cost: "Verifiers cannot select the signing key from JWKS.",
      envKeys: ["MANDATE_SIGNING_KID"],
    },
    {
      id: "cron_secret",
      level: "blocking",
      ok: process.env.NODE_ENV !== "production" || envSet("CRON_SECRET"),
      cost: "Production crons fail closed (503) — follow-ups and digest stop.",
      envKeys: ["CRON_SECRET"],
    },
    {
      id: "mandate_issuer",
      level: "consumer",
      ok: envSet("MANDATE_ISSUER"),
      cost: "Status lists may use wrong issuer URL vs your production domain.",
      envKeys: ["MANDATE_ISSUER"],
    },
    {
      id: "app_url",
      level: "consumer",
      ok: envSet("NEXT_PUBLIC_APP_URL"),
      cost: "Links in email and mandates may point at the wrong host.",
      envKeys: ["NEXT_PUBLIC_APP_URL"],
    },
    {
      id: "smtp",
      level: "consumer",
      ok: smtpConfigured(),
      cost: "Outbox stays QUEUED — providers never receive mail.",
      envKeys: ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"],
    },
    {
      id: "smtp_from",
      level: "consumer",
      ok: envSet("SMTP_FROM", ["SMTP_USER"]),
      cost: "From address may fail SPF/DKIM — Gmail marks mail unverified.",
      envKeys: ["SMTP_FROM"],
    },
    {
      id: "payments_live",
      level: "consumer",
      ok: paymentsFullyLive(),
      cost: "Success fees use mock checkout — no real money collected.",
      envKeys: ["PAYMENT_PROVIDER", "PAYPLUS_API_KEY", "PAYPLUS_SECRET_KEY", "PAYPLUS_PAYMENT_PAGE_UID"],
    },
    {
      id: "admin_email",
      level: "consumer",
      ok: envSet("ADMIN_EMAIL"),
      cost: "Founder dashboard closed — you cannot see leads or release score in prod.",
      envKeys: ["ADMIN_EMAIL"],
    },
    {
      id: "ai",
      level: "consumer",
      ok: aiConfigured(),
      cost: "Bill OCR and rich drafts unavailable — templates only.",
      envKeys: ["ANTHROPIC_API_KEY"],
    },
    {
      id: "leads_email",
      level: "consumer",
      ok: envSet("LEADS_EMAIL", ["NEXT_PUBLIC_SUPPORT_EMAIL"]),
      cost: "Consumer lead mail falls back to founder inbox only.",
      envKeys: ["LEADS_EMAIL"],
    },
    {
      id: "sales_email",
      level: "consumer",
      ok: envSet("SALES_EMAIL", ["NEXT_PUBLIC_SUPPORT_EMAIL"]),
      cost: "Institutional enquiries have no dedicated inbox.",
      envKeys: ["SALES_EMAIL"],
    },
    {
      id: "vapid",
      level: "consumer",
      ok: envSet("VAPID_PUBLIC_KEY", ["NEXT_PUBLIC_VAPID_PUBLIC_KEY"]) && envSet("VAPID_PRIVATE_KEY"),
      cost: "Push notifications off — users miss inbound savings and SAVED moments.",
      envKeys: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "NEXT_PUBLIC_VAPID_PUBLIC_KEY"],
    },
    {
      id: "oracle_api",
      level: "optional",
      ok: envSet("ORACLE_API_KEY", ["ZAKAI_ORACLE_API_KEY"]),
      cost: "Prediction API closed — intentional until institutional customer.",
      envKeys: ["ORACLE_API_KEY"],
    },
    {
      id: "android_twa",
      level: "optional",
      ok: envSet("ANDROID_CERT_FINGERPRINTS"),
      cost: "Play TWA shows browser URL bar.",
      envKeys: ["ANDROID_CERT_FINGERPRINTS"],
    },
  ];

  const scored = checks.filter((c) => c.level !== "optional");
  const on = scored.filter((c) => c.ok).length;
  const releaseScore = scored.length === 0 ? 0 : Math.round((on / scored.length) * 100);
  const failingIds = scored.filter((c) => !c.ok).map((c) => c.id);

  return {
    checks,
    releaseScore,
    canReleaseConsumerApp: failingIds.length === 0,
    failingIds,
  };
}
