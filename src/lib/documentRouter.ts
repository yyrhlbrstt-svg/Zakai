/**
 * What is this document, and which tool handles it?
 *
 * THE GAP THIS CLOSES
 *
 * `analyzeBillImage` is scoped, in its own system prompt, to "Israeli MOBILE
 * phone bills". Anything else — an electricity bill, a bank statement, an
 * arnona notice, a supermarket receipt — comes back `readable: false`, and the
 * UI renders that as "I couldn't read the image, try a clearer photo."
 *
 * So the app blamed the reader's camera for a document it was never asked to
 * understand. Photograph a perfectly sharp electricity bill on /check and it
 * tells you to take a better picture. Reported, accurately, as an analyser
 * that "doesn't know anything and doesn't do anything".
 *
 * The routing table is deliberately a pure function of a classified kind, with
 * no AI in it. The model's only job is to name what it is looking at; deciding
 * where that goes is product code, and it is tested here without a network
 * call. That split is the same one the rest of this codebase enforces: the LLM
 * proposes, product code executes.
 */

/** Document kinds the product has somewhere to send. */
export const DOCUMENT_KINDS = [
  "mobile_bill",
  "internet_bill",
  "electricity_bill",
  "water_bill",
  "arnona_bill",
  "bank_statement",
  "card_statement",
  "receipt",
  "subscription_notice",
  "insurance_policy",
  "unknown",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export function isDocumentKind(v: unknown): v is DocumentKind {
  return typeof v === "string" && (DOCUMENT_KINDS as readonly string[]).includes(v);
}

export interface DocumentRoute {
  kind: DocumentKind;
  /** In-app path that actually handles this document, or null if none does. */
  href: string | null;
  /**
   * True when the tool the reader is already on is the right one — the caller
   * should carry on rather than send them somewhere else.
   */
  handledHere: boolean;
  /** i18n key for the sentence shown to the reader. Never free text. */
  messageKey: string;
}

/**
 * Where each kind is handled. `null` means the product has no tool for it yet,
 * which is a thing to say plainly rather than route around: sending someone to
 * a page that cannot help them is the dead-end CTA this whole change exists to
 * remove.
 */
const ROUTES: Record<DocumentKind, string | null> = {
  mobile_bill: "/check",
  internet_bill: "/check",
  electricity_bill: "/electricity",
  water_bill: "/water-bill",
  arnona_bill: "/arnona",
  bank_statement: "/money",
  card_statement: "/money",
  receipt: "/receipts",
  subscription_notice: "/cancel",
  // No insurance tool exists yet. Saying so beats inventing a destination.
  insurance_policy: null,
  unknown: null,
};

/**
 * Route a classified document, given the page the reader is already on.
 *
 * `currentPath` is compared without locale prefix — callers pass the routing
 * path ("/check"), not the rendered URL ("/he/check").
 */
export function routeDocument(kind: DocumentKind, currentPath?: string): DocumentRoute {
  const href = ROUTES[kind];

  if (href && currentPath && normalizePath(href) === normalizePath(currentPath)) {
    return { kind, href, handledHere: true, messageKey: "docRoute.handledHere" };
  }

  if (!href) {
    return {
      kind,
      href: null,
      handledHere: false,
      messageKey: kind === "unknown" ? "docRoute.unknown" : "docRoute.noToolYet",
    };
  }

  return { kind, href, handledHere: false, messageKey: `docRoute.kinds.${kind}` };
}

function normalizePath(p: string): string {
  const trimmed = p.trim().replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed.toLowerCase();
}

/** Every kind that the product can currently act on. */
export function routableKinds(): DocumentKind[] {
  return DOCUMENT_KINDS.filter((k) => ROUTES[k] !== null);
}
