import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import {
  DOCUMENT_KINDS,
  isDocumentKind,
  routableKinds,
  routeDocument,
  type DocumentKind,
} from "./documentRouter";

describe("routeDocument", () => {
  it("sends an electricity bill to the electricity tool, not a camera error", () => {
    // The reported failure: this arrived on /check and was answered with
    // "I couldn't read the image, try a clearer photo."
    const r = routeDocument("electricity_bill", "/check");
    expect(r.href).toBe("/electricity");
    expect(r.handledHere).toBe(false);
  });

  it("stays put when the reader is already on the right tool", () => {
    const r = routeDocument("mobile_bill", "/check");
    expect(r.handledHere).toBe(true);
    expect(r.href).toBe("/check");
  });

  it("ignores a trailing slash and casing when comparing the current page", () => {
    expect(routeDocument("mobile_bill", "/check/").handledHere).toBe(true);
    expect(routeDocument("mobile_bill", "/Check").handledHere).toBe(true);
  });

  it("treats a locale-prefixed URL as a different path, so callers must pass the routing path", () => {
    // Documented behaviour rather than a silent surprise: "/he/check" is not
    // the routing path, and quietly matching it would hide a caller bug.
    expect(routeDocument("mobile_bill", "/he/check").handledHere).toBe(false);
  });

  it("says plainly when no tool exists rather than inventing a destination", () => {
    const r = routeDocument("insurance_policy", "/check");
    expect(r.href).toBeNull();
    expect(r.messageKey).toBe("docRoute.noToolYet");
  });

  it("distinguishes 'we have no tool' from 'we could not tell what this is'", () => {
    // These need different sentences: one is our gap, the other is a bad photo.
    expect(routeDocument("unknown").messageKey).toBe("docRoute.unknown");
    expect(routeDocument("insurance_policy").messageKey).not.toBe("docRoute.unknown");
  });

  it("routes bank and card statements to the scan that handles them", () => {
    expect(routeDocument("bank_statement").href).toBe("/money");
    expect(routeDocument("card_statement").href).toBe("/money");
  });

  it("never returns handledHere with no destination", () => {
    for (const kind of DOCUMENT_KINDS) {
      const r = routeDocument(kind, "/check");
      if (r.handledHere) expect(r.href).not.toBeNull();
    }
  });

  it("always returns a message key for every kind", () => {
    for (const kind of DOCUMENT_KINDS) {
      expect(routeDocument(kind).messageKey).toMatch(/^docRoute\./);
    }
  });
});

describe("routing targets", () => {
  /**
   * The point of routing is that the destination exists. A typo here would
   * turn "we know what this is" into a 404, which is a worse answer than the
   * camera error it replaced.
   */
  it("points only at pages that actually exist", () => {
    for (const kind of routableKinds()) {
      const href = routeDocument(kind).href!;
      expect(
        existsSync(`src/app/[locale]${href}/page.tsx`),
        `${kind} routes to ${href}, which has no page.tsx`,
      ).toBe(true);
    }
  });

  it("has at least one routable kind, so the suite above is not vacuous", () => {
    expect(routableKinds().length).toBeGreaterThan(5);
  });
});

describe("every kind has copy to show", () => {
  /**
   * A kind with no string renders its raw i18n key to the reader — the
   * "leaking i18n keys" failure this project has hit before. Hebrew is the
   * primary locale, so it is the one that must be complete.
   */
  const he = JSON.parse(readFileSync("src/messages/he.json", "utf8")) as {
    flow: { docRoute: { kinds: Record<string, string>; goTo: string; unknown: string; noToolYet: string } };
  };

  it("has a Hebrew sentence for every kind except unknown", () => {
    const missing = DOCUMENT_KINDS.filter(
      (k) => k !== "unknown" && !he.flow.docRoute.kinds[k],
    );
    expect(missing, `no Hebrew copy for: ${missing.join(", ")}`).toEqual([]);
  });

  it("has the shared sentences the router can return", () => {
    expect(he.flow.docRoute.goTo).toBeTruthy();
    expect(he.flow.docRoute.unknown).toBeTruthy();
    expect(he.flow.docRoute.noToolYet).toBeTruthy();
  });
});

describe("isDocumentKind", () => {
  it("accepts every declared kind", () => {
    for (const k of DOCUMENT_KINDS) expect(isDocumentKind(k)).toBe(true);
  });

  it("rejects anything a model might invent", () => {
    // The classifier is an LLM; its output is untrusted input at this boundary.
    for (const bad of ["", "BILL", "mobile bill", "gas_bill", null, 7, {}]) {
      expect(isDocumentKind(bad as unknown)).toBe(false);
    }
  });
});

describe("kind coverage", () => {
  it("keeps unknown as the fallback kind", () => {
    const kinds: readonly DocumentKind[] = DOCUMENT_KINDS;
    expect(kinds).toContain("unknown");
  });
});
