# Institution quickstart — Mandate verification in ~30 minutes

This guide is for a bank, insurer, utility, or fintech that must answer: **did this
customer authorise this agent, for this action, right now?**

Zakai does not need to be in the hot path for every verification. Your service can
verify offline against published keys and the trust registry.

## 1. Read the discovery document (5 min)

```
GET https://zakai-3uxj.vercel.app/.well-known/zakai-mandate.json
```

Note: JWKS URL, verify endpoint, forbidden scopes, revocation feed.

## 2. Fetch the trust registry (2 min)

```
GET https://zakai-3uxj.vercel.app/.well-known/zakai-trust-registry.json
```

Reject mandates from issuers that are `suspended` or not listed. Resolve each
issuer's JWKS from the registry entry — do not hard-code a single Zakai key for
delegated issuers.

## 3. Verify a mandate (10 min)

**Option A — HTTP (CORS-enabled):**

```
POST https://zakai-3uxj.vercel.app/api/mandate/verify
Content-Type: application/json

{ "mandate": "<JWS compact>" }
```

**Option B — SDK (TypeScript, runs in your VPC):**

```bash
npm install @zakai/mandate-sdk
```

```ts
import { verifyMandateWithRegistry } from "@zakai/mandate-sdk/registry";

const result = await verifyMandateWithRegistry(jws, {
  trustRegistryUrl: "https://zakai-3uxj.vercel.app/.well-known/zakai-trust-registry.json",
});
```

**Option C — MCP (for internal AI tooling):**

```bash
npx zakai-mandate-mcp
```

Tools: `verify_mandate`, `decide_action`, `check_revocation`, `get_trust_registry`,
`list_scopes`, `predict_outcome` (Oracle requires `ZAKAI_ORACLE_API_KEY`).

## 4. Decide whether to act (5 min)

```
POST https://zakai-3uxj.vercel.app/api/mandate/decide
```

Pass the mandate JWS + the action your system wants to perform (e.g.
`correspondence.send`). The response is allow/deny with scope and audience checks.

## 5. Revocation (ongoing)

Before acting on a high-impact request, check live revocation:

```
GET https://zakai-3uxj.vercel.app/api/mandate/revocations
```

Fail closed if the mandate `jti` appears in the feed.

## 6. Become a delegated issuer (optional)

If you issue mandates on your own keys (same protocol, your brand):

```
POST https://zakai-3uxj.vercel.app/api/mandate/delegation/apply
```

UI: `/en/institutions` — Delegation apply form.

## Machine-readable vertical map

For product teams mapping consumer-agent use cases:

```
GET https://zakai-3uxj.vercel.app/api/network/opportunity-map
GET https://zakai-3uxj.vercel.app/api/network/opportunity-map?market=IL
```

## What you must not expect

- No outward money-movement scopes (`FORBIDDEN_SCOPES` in registry).
- Zakai does not file in court or impersonate the customer — correspondence only.
- Verification answers cryptography + policy; it does not guarantee claim outcomes.

## Contact

Institutional enquiries: `/en/institutions` lead form, or the address configured in
`SALES_EMAIL` / `ADMIN_EMAIL` in production.
