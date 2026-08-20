/**
 * The recipient directory — Master Build Prompt v2, Phase 1: "who actually
 * receives a demand" as versioned, verified data behind one resolver.
 *
 * The graph already names recipients by ref ("provider:self",
 * "regulator:tax-authority"), but until this module nothing resolved them:
 * regulator identities lived in complaintEscalation.ts, provider inboxes in
 * four separate contact modules, and a registry entry could point at a ref
 * that existed nowhere. Now every ref resolves here or the registry test
 * fails — a dangling recipient is a CI failure, not a letter that never
 * finds its addressee.
 *
 * Honesty rules, same as everywhere else in the graph:
 *  - Every regulator entry carries sourceUrl + lastVerifiedAt: the date a
 *    human actually confirmed the body, its name, and its intake channel
 *    against official sources. No date, no entry.
 *  - A demand channel is present only when verified; a body whose intake we
 *    have not confirmed gets `demand: null`, never a guessed address.
 *  - Provider addresses are NOT duplicated into this file — they stay in the
 *    per-vertical contact modules (with their own never-invent rules) and are
 *    reached through one dispatch, so there is exactly one place a caller
 *    asks "where does this demand go" and zero places addresses can drift.
 *
 * Pure and client-safe (env reads happen inside the delegated resolvers).
 */

import { resolveTelecomContactEmail } from "@/lib/telecomContacts";
import {
  resolveElectricityContactEmail,
  resolveInsuranceContactEmail,
  resolveTransportContactEmail,
} from "@/lib/utilityContacts";
import { resolveBankContactEmail } from "@/lib/bankContacts";
import { resolveAirlineContactEmail } from "@/lib/airlineContacts";

/** How a written demand or complaint actually reaches the body — verified, never guessed. */
export type DemandChannel =
  | { channel: "email"; address: string }
  | { channel: "web_form"; url: string };

export interface RegulatorEntry {
  ref: string;
  legalName: { he: string; en: string };
  /** What this body supervises, for a report a human can read without a lookup. */
  supervises: { he: string; en: string };
  demand: DemandChannel | null;
  /** Official page this entry was confirmed against. */
  sourceUrl: string;
  /** ISO date a human last confirmed name + intake channel against the source. */
  lastVerifiedAt: string;
}

/**
 * Every regulator the graph or the escalation ladder can address.
 * Re-verified 2026-08-20 against boi.org.il and gov.il (unit names, intake
 * URLs, and the BoI public-inquiries mailbox).
 */
export const REGULATORS: readonly RegulatorEntry[] = [
  {
    ref: "regulator:boi-banking-supervision",
    legalName: {
      he: "הפיקוח על הבנקים — היחידה לפניות הציבור ולבקרה צרכנית (בנק ישראל)",
      en: "Banking Supervision — Public Inquiries and Consumer Supervision Unit (Bank of Israel)",
    },
    supervises: {
      he: "בנקים וחברות כרטיסי אשראי (סעיף 16 לחוק הבנקאות (שירות ללקוח), התשמ\"א-1981)",
      en: "Banks and credit-card companies (s.16, Banking (Service to Customer) Law, 1981)",
    },
    demand: { channel: "email", address: "pz@boi.org.il" },
    sourceUrl: "https://www.boi.org.il/information/public-enquiries-unit/",
    lastVerifiedAt: "2026-08-20",
  },
  {
    ref: "regulator:moc-public-inquiries",
    legalName: {
      he: "משרד התקשורת — אגף פניות הציבור",
      en: "Ministry of Communications — Public Inquiries Department",
    },
    supervises: {
      he: "בעלי רישיון בתחום התקשורת — סלולר, אינטרנט, טלפוניה, טלוויזיה, דואר",
      en: "Telecom licensees — cellular, internet, landline, TV, postal",
    },
    demand: {
      channel: "web_form",
      url: "https://www.gov.il/he/departments/topics/communications_public_inquiries/govil-landing-page",
    },
    sourceUrl:
      "https://www.gov.il/he/departments/topics/communications_public_inquiries/govil-landing-page",
    lastVerifiedAt: "2026-08-20",
  },
  {
    ref: "regulator:consumer-protection-authority",
    legalName: {
      he: "הרשות להגנת הצרכן ולסחר הוגן",
      en: "Consumer Protection and Fair Trade Authority",
    },
    supervises: {
      he: "צרכנות כללית — הטעיה, חיוב ללא הרשאה, אחריות ושירות, ביטול עסקה",
      en: "General consumer protection — deception, unauthorized charges, warranty/service, cancellation rights",
    },
    demand: {
      channel: "web_form",
      url: "https://www.gov.il/he/service/filing_a_complaint_to_fair_trade_authority",
    },
    sourceUrl: "https://www.gov.il/he/service/filing_a_complaint_to_fair_trade_authority",
    lastVerifiedAt: "2026-08-20",
  },
  {
    ref: "regulator:tax-authority",
    legalName: {
      he: "רשות המסים בישראל",
      en: "Israel Tax Authority",
    },
    supervises: {
      he: "מס הכנסה, מע\"מ, מכס ומיסוי מקרקעין; החזרי מס לשכירים דרך האזור האישי",
      en: "Income tax, VAT, customs, real-estate tax; employee tax refunds via the personal zone",
    },
    demand: {
      channel: "web_form",
      url: "https://secapp.taxes.gov.il/srsherutatzmi",
    },
    sourceUrl: "https://www.gov.il/he/departments/israel_tax_authority/govil-landing-page",
    lastVerifiedAt: "2026-08-20",
  },
];

export function getRegulator(ref: string): RegulatorEntry | undefined {
  return REGULATORS.find((r) => r.ref === ref);
}

/**
 * What a directoryRef means once resolved:
 *  - "self": the counterparty on the case itself — an address the directory
 *    cannot know statically; it comes from case data at demand-build time.
 *  - "regulator": a verified entry from REGULATORS above.
 *  - null: the ref names nothing — which the registry test turns into a CI
 *    failure, so it can only happen for refs arriving from outside the graph.
 */
export type DirectoryResolution =
  | { kind: "self" }
  | { kind: "regulator"; entry: RegulatorEntry }
  | null;

export function resolveDirectoryRef(ref: string): DirectoryResolution {
  if (ref === "provider:self") return { kind: "self" };
  if (ref.startsWith("regulator:")) {
    const entry = getRegulator(ref);
    return entry ? { kind: "regulator", entry } : null;
  }
  return null;
}

/**
 * The one door to every provider-inbox dataset. Each delegate keeps its own
 * never-invent rule (unknown → null, no placeholder that could be sent), and
 * this dispatch adds nothing on top — it only ends the era of each caller
 * needing to know which of five modules holds the address for its vertical.
 */
export function resolveProviderDemandEmail(
  vertical: string,
  providerKeyOrName: string,
): string | null {
  const name = providerKeyOrName.trim();
  if (!name) return null;
  switch (vertical) {
    case "telecom":
      return resolveTelecomContactEmail(name);
    case "electricity":
      return resolveElectricityContactEmail(name);
    case "insurance":
    case "car-insurance-refund":
      return resolveInsuranceContactEmail(name);
    case "transport-fine":
      return resolveTransportContactEmail(name);
    case "flights":
    case "baggage":
      return resolveAirlineContactEmail(name) || null;
    case "bank-fees":
    case "deposit":
    case "late-payment":
    case "refund-chase":
      return resolveBankContactEmail(name) || null;
    default:
      return null;
  }
}
