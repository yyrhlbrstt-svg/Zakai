/**
 * Partner embed `data-path` keys — keep in sync with public/embed.js ALLOWED_PATHS.
 */
export const EMBED_PARTNER_PATH_KEYS = [
  "money",
  "cancel",
  "check",
  "bank-fees",
  "electricity",
  "leaks",
  "refund-chase",
  "flights",
  "deposit",
  "duplicate-insurance",
  "arnona",
  "warranty",
  "parking",
  "what-am-i-owed",
  "start",
] as const;

export type EmbedPartnerPathKey = (typeof EMBED_PARTNER_PATH_KEYS)[number];
