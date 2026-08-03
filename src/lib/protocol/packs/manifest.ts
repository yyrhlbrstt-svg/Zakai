import { ZML_VERSION } from "@/lib/protocol/zml/constants";

const PACKS_CDN = (process.env.ZML_PACKS_CDN || "https://packs.zakai.io").replace(/\/+$/, "");

/** Machine discovery for external ZML adopters (packs repo, CDN, engine APIs). */
export function buildPacksManifest(origin: string) {
  const base = origin.replace(/\/+$/, "");
  return {
    spec: "zakai-packs",
    version: "2026-08-03",
    zml_version: ZML_VERSION,
    cdn_base: PACKS_CDN,
    bundled_path: "zakai-packs/",
    repository: {
      export_script: "scripts/export-zakai-packs-repo.sh",
      validate: "npm run packs:validate",
      publish_dry_run: "npm run packs:publish:dry",
      verify_cdn: "npm run verify:packs-cdn",
      upstream_readme: "zakai-packs/README.md",
    },
    schema: `${base}/.well-known/zakai-rights-schema.json`,
    endpoints: {
      catalog: `${base}/api/rights/catalog`,
      evaluate: `${base}/api/rights/evaluate/{id}`,
      stats: `${base}/api/zml/stats`,
      markets: `${base}/api/markets`,
      admin_reload: `${base}/api/admin/packs/reload`,
    },
    interop_profile: "rights_catalog",
    docs: {
      country_packs: "docs/COUNTRY_PACKS.md",
      infra: "docs/INFRA_ZAKAI_PACKS.md",
      sdk_integration: "docs/ZML_SDK_INTEGRATION.md",
    },
    sdk: {
      mandate: "sdk/README.md",
      npm_name: "@zakai/mandate-sdk",
      mcp: "zakai-mandate-mcp",
      interop_profiles: ["zakai-mandate-verifier-1", "zakai-rights-catalog-1"],
    },
    delegated_issuers: `${base}/api/mandate/delegation/issuers`,
  };
}
