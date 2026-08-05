import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * openapi.json is the machine-readable contract an integrator generates a
 * client from — distinct from the discovery document, which is the prose an
 * integrator reads first. The two drifted here: `issue_uri` was disclosed in
 * discovery.json from the day delegated issuance shipped, but the OpenAPI
 * path for that exact endpoint was never added, so a codegen tool building
 * against this spec produced a client that could discover, verify, decide and
 * check status — and could not mint a single mandate.
 *
 * This mirrors discovery.test.ts one file over: a real capability with no
 * trace in the one document a specific class of integrator actually reads.
 */
const source = readFileSync("src/app/api/mandate/openapi.json/route.ts", "utf8");

describe("openapi.json documents every institutional endpoint it grants", () => {
  it("documents the endpoint that mints a mandate", () => {
    expect(source).toContain('"/api/mandate/issue"');
    expect(source).toContain("delegation_refused");
  });

  it("documents the trust registry and the conformance suite that admits into it", () => {
    // Both existed as real, working endpoints before either had a path entry
    // here — trust-registry.json was at least linked from discovery.json and
    // the institutions page; conformance.json had no trace anywhere at all.
    expect(source).toContain('"/.well-known/zakai-trust-registry.json"');
    expect(source).toContain('"/.well-known/zakai-conformance.json"');
  });

  it("documents the endpoint that independently probes a candidate's conformance", () => {
    expect(source).toContain('"/api/mandate/conformance/probe"');
  });

  it("defines a security scheme for the issuance key it requires", () => {
    expect(source).toContain("zakaiIssueKey");
    expect(source).toContain("x-zakai-issue-key");
  });

  it("documents fail-closed revoke (no invent) and status-list preference", () => {
    expect(source).not.toContain("Always allocates a statusIndex");
    expect(source).toContain("status_index_unknown");
    expect(source).toContain("zkm.status");
  });

  it("never references a tag it did not declare", () => {
    // A tag used on an operation but missing from the top-level `tags` array
    // is still valid OpenAPI — Swagger UI just renders it with no
    // description, which is how "delegation" sat undocumented next to seven
    // properly-described neighbours. Comparing the two sets directly means
    // the next endpoint added under a new tag fails loudly instead of
    // shipping quietly half-labelled.
    const declared = new Set(
      [...source.matchAll(/\{ name: "([a-z]+)", description:/g)].map((m) => m[1]),
    );
    const used = new Set([...source.matchAll(/tags: \["([a-z]+)"\]/g)].map((m) => m[1]));
    expect(declared.size).toBeGreaterThan(0);
    expect(used.size).toBeGreaterThan(0);
    for (const tag of used) {
      expect({ tag, declared: declared.has(tag) }).toEqual({ tag, declared: true });
    }
  });
});
