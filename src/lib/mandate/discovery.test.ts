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
});
