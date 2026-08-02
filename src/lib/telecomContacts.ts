/**
 * Public customer-service inboxes for Israeli mobile/ISP brands.
 * Used for telecom Case outreach — verify on the provider's site if unsure.
 */

const TELECOM_INBOX: Record<string, string> = {
  cellcom: "service@cellcom.co.il",
  partner: "service@partner.co.il",
  bezeq: "service@bezeq.co.il",
  hot: "service@hotmobile.co.il",
  yes: "service@yes.co.il",
};

export function resolveTelecomContactEmail(providerKey: string): string | null {
  const key = providerKey.trim().toLowerCase();
  return TELECOM_INBOX[key] ?? null;
}

export function telecomNeedsContactEmail(providerKey: string, override?: string): boolean {
  if (override?.trim() && /@/.test(override)) return false;
  return resolveTelecomContactEmail(providerKey) === null;
}
