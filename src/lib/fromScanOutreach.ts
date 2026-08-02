import { buildCancelLetter, type CancelIntent } from "@/lib/cancelLetter";
import { formatCaseDraft } from "@/lib/caseDraft";
import { firstOutreachEmail } from "@/lib/outreachEmail";
import { resolveSubscriptionCompany, pickOutreachEmail } from "@/lib/normalizeSubscriptionProvider";
import { resolveProviderKey } from "@/lib/providers";
import { resolveTelecomContactEmail } from "@/lib/telecomContacts";

export type ScanCategory =
  | "cellular"
  | "tv_internet"
  | "electricity"
  | "insurance"
  | "fitness"
  | "digital"
  | "other";

export function scanVertical(category: ScanCategory): string {
  if (category === "cellular" || category === "tv_internet") return "telecom";
  if (category === "electricity") return "electricity";
  if (category === "insurance") return "insurance";
  return "subscription";
}

export function defaultScanIntent(category: ScanCategory): CancelIntent {
  return category === "digital" || category === "fitness" || category === "other"
    ? "cancel"
    : "retention";
}

export function resolveFromScanOutreach(input: {
  merchant: string;
  product: string;
  category: ScanCategory;
  contactEmail?: string;
}): { vertical: string; providerKey: string; outreachTo: string | null } {
  const vertical = scanVertical(input.category);
  const resolved = resolveSubscriptionCompany(input.merchant, input.product);
  let outreachTo: string | null = null;

  if (vertical === "telecom") {
    const telecomKey = resolveProviderKey(input.merchant);
    outreachTo =
      firstOutreachEmail(input.contactEmail) ?? resolveTelecomContactEmail(telecomKey);
    return { vertical, providerKey: telecomKey, outreachTo };
  }

  if (vertical === "subscription") {
    outreachTo = pickOutreachEmail({
      contactEmail: input.contactEmail,
      defaultContactEmail: resolved.defaultContactEmail,
    });
    return { vertical, providerKey: resolved.providerKey, outreachTo };
  }

  outreachTo = firstOutreachEmail(input.contactEmail);
  return { vertical, providerKey: resolved.providerKey.slice(0, 80), outreachTo };
}

export function buildFromScanDraft(input: {
  customerName: string;
  merchant: string;
  product: string;
  monthlyShekels: number;
  intent: CancelIntent;
  country?: string | null;
}): { subject: string; body: string; draftMessage: string } {
  const resolved = resolveSubscriptionCompany(input.merchant, input.product);
  const letter = buildCancelLetter({
    customerName: input.customerName,
    company: resolved.displayName,
    product: input.product,
    monthlyShekels: input.monthlyShekels,
    intent: input.intent,
  });
  return {
    subject: letter.subject,
    body: letter.body,
    draftMessage: formatCaseDraft(letter.subject, letter.body, input.country),
  };
}
