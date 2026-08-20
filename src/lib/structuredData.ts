import { SITE_URL } from "@/lib/seo";
import { configuredSupportEmail } from "@/lib/contact";

/**
 * Organization and WebSite structured data.
 *
 * Only facts that are true and checkable go in here. No `aggregateRating`, no
 * `review`, no employee count, no founding-date flourish — a schema block is
 * a machine-readable claim, and inventing one is the same as inventing a
 * traction number on a page, except harder for anyone to notice.
 *
 * `SearchAction` is deliberately absent too: there is no site-wide search
 * endpoint, and declaring one that 404s is a claim about a feature we do not
 * have.
 */
export function organizationJsonLd(locale: string) {
  // Only a CONFIGURED mailbox goes into the schema. The founder-inbox
  // fallback keeps mailto paths alive elsewhere, but publishing a personal
  // gmail as the organization's address in machine-readable data (which
  // Google indexes and shows) is the "hobby project" signal this block
  // exists to avoid. The contact page URL is always present either way.
  const email = configuredSupportEmail();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Zakai",
        alternateName: "זכאי",
        url: SITE_URL,
        logo: `${SITE_URL}/icon.svg`,
        ...(email ? { email } : {}),
        contactPoint: [
          {
            "@type": "ContactPoint",
            // Deliberately not "customer service" with a phone number: there
            // is no phone line, and listing one that nobody answers is worse
            // than listing none.
            contactType: "customer support",
            ...(email ? { email } : {}),
            url: `${SITE_URL}/${locale}/contact`,
            availableLanguage: ["he", "en", "ar", "ru"],
          },
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: `${SITE_URL}/${locale}`,
        name: "Zakai",
        inLanguage: locale,
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };
}
