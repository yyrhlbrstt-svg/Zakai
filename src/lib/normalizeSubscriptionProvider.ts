/** Map subscription merchant names to stable provider keys + optional outreach email. */

export interface SubscriptionProviderResolved {
  providerKey: string;
  displayName: string;
  /** Known public support/cancel inbox; user may override. */
  defaultContactEmail?: string;
}

const BRANDS: {
  key: string;
  displayHe: string;
  patterns: RegExp[];
  contactEmail?: string;
}[] = [
  {
    key: "netflix",
    displayHe: "Netflix",
    patterns: [/netflix/i, /נטפליקס/],
    contactEmail: "info@netflix.com",
  },
  {
    key: "spotify",
    displayHe: "Spotify",
    patterns: [/spotify/i, /ספוטיפיי/],
    contactEmail: "support@spotify.com",
  },
  {
    key: "yes",
    displayHe: "YES",
    patterns: [/^yes$/i, /יס\b/, /yes streaming/i],
  },
  {
    key: "hot",
    displayHe: "HOT",
    patterns: [/^hot$/i, /הוט\b/],
  },
  {
    key: "cellcom",
    displayHe: "סלקום",
    patterns: [/cellcom/i, /סלקום/],
  },
];

export function resolveSubscriptionCompany(company: string, product?: string): SubscriptionProviderResolved {
  const hay = `${company} ${product ?? ""}`.trim();
  for (const b of BRANDS) {
    if (b.patterns.some((p) => p.test(hay))) {
      return {
        providerKey: b.key,
        displayName: b.displayHe,
        defaultContactEmail: b.contactEmail,
      };
    }
  }
  const displayName = company.trim() || product?.trim() || "הספק";
  return {
    providerKey: displayName.slice(0, 80),
    displayName: displayName.slice(0, 120),
  };
}

export function pickOutreachEmail(input: {
  contactEmail?: string;
  accountOrEmail?: string;
  defaultContactEmail?: string;
}): string | null {
  const explicit = input.contactEmail?.trim();
  if (explicit && /@/.test(explicit)) return explicit.toLowerCase();
  const acct = input.accountOrEmail?.trim();
  if (acct && /@/.test(acct)) return acct.toLowerCase();
  const def = input.defaultContactEmail?.trim();
  if (def && /@/.test(def)) return def.toLowerCase();
  return null;
}

export function subscriptionOutreachReady(
  company: string,
  product: string,
  contactEmail?: string,
): boolean {
  const resolved = resolveSubscriptionCompany(company, product);
  return (
    pickOutreachEmail({
      contactEmail,
      defaultContactEmail: resolved.defaultContactEmail,
    }) !== null
  );
}
