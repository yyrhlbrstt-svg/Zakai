import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { MANDATE_TYPE, LEGACY_MANDATE_TYPE } from "./mandate";
import { STATUS_LIST_TYPE } from "./statusList";
import { FORBIDDEN_SCOPES } from "./scopes";

/**
 * The discovery document is the only thing an outside implementer reads before
 * writing code. When it drifts from what we actually sign, every integration
 * built from it rejects every mandate we issue — and the failure looks like our
 * tokens are broken rather than our documentation.
 *
 * It said `typ: "zakai-mandate+jws"` for a while after the move to JWT. Nothing
 * caught it, because nothing was watching. This is that.
 */
const source = readFileSync("src/app/.well-known/zakai-mandate.json/route.ts", "utf8");

describe("the published spec matches what we actually sign", () => {
  it("advertises the type we really use", () => {
    expect(source).toContain(`typ: "${MANDATE_TYPE}"`);
    expect(source).toContain(`legacy_typ: "${LEGACY_MANDATE_TYPE}"`);
  });

  it("advertises the status list we really serve", () => {
    expect(source).toContain(`status_list_type: "${STATUS_LIST_TYPE}"`);
    expect(source).toContain("status_list_uri");
  });

  it("points at the trust registry, so we are not the only possible issuer", () => {
    expect(source).toContain("trust_registry_uri");
  });

  it("publishes every forbidden scope, so an institution can bound its risk", () => {
    for (const scope of FORBIDDEN_SCOPES) {
      expect({ scope, published: source.includes(`"${scope}"`) }).toEqual({
        scope,
        published: true,
      });
    }
  });

  it("gives working code in more than one language", () => {
    // A protocol nobody can implement in ten minutes is a specification, not a
    // standard.
    for (const lang of ["node:", "python:", "go:", "curl:"]) {
      expect(source).toContain(lang);
    }
    // And none of those examples may require anything of ours.
    const examples = source.slice(source.indexOf("examples: {"));
    expect(examples).not.toMatch(/@zakai\/|zakai-sdk|require\(['"]zakai/);
  });

  it("discloses delegated issuance and how to spot it", () => {
    // Built, then silently undiscoverable for a while — the same failure mode
    // as the stale typ above, just one layer up: a real capability with no
    // trace in the one document an integrator actually reads.
    expect(source).toContain("zkm.onBehalfOf");
    expect(source).toContain("delegated_issuance");
  });

  it("discloses the conformance suite for becoming a registered issuer", () => {
    // The admission test (conformance.ts) and the registry it feeds
    // (trustRegistry.ts) existed with zero mention anywhere a candidate issuer
    // would think to look — not here, not on the institutions page, not in
    // openapi.json. A path with no trace in any of the three places an
    // integrator reads is not a path anyone finds by accident.
    expect(source).toContain("conformance_uri");
  });

  it("states the specification is royalty-free to implement, without needing our permission", () => {
    // The objection that stops an integration before it starts is legal, not
    // technical — "can we get sued for building against a private company's
    // protocol." A promise buried in a repository README nobody outside the
    // team reads does not answer that for an engineer deciding whether to
    // spend a sprint on this.
    expect(source).toContain("licensing");
    expect(source).toMatch(/royalty/);
    expect(source).toContain("MIT");
  });

  it("states the stability policy that makes this worth building against", () => {
    // The question that decides whether an integration gets built at all: will
    // this still mean the same thing in a year. A promise made only in a
    // repository doc nobody outside the team reads is not a promise an
    // institution can rely on.
    expect(source).toContain("stability");
    expect(source).toMatch(/additive-only/);
    expect(source).toMatch(/180-day/);
  });
});
