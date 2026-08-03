# Institution quickstart — Mandate verification in ~15 minutes

This guide is for a bank, insurer, utility, or fintech that must answer: **did this
customer authorise this agent, for this action, right now?**

**Clear gate:** pass authorization test vectors + verify the signed Status List →
`READY_FOR_PIONEER` → claim a Pioneer slot at `/institutions/leader`.  
That is **not** regulatory certification. The leaders wall stays empty until a real opt-in.

Zakai does not need to be in the hot path for every verification. Your service can
verify offline against published keys and the trust registry.

## 0. One command (preferred)

**Node (SDK — cryptographic Status List verify):**

```bash
# From this monorepo (works today without npm publish):
cd sdk && npm ci && npm run ready -- --origin https://zakai-3uxj.vercel.app

# After @zakai/mandate-sdk is published:
# npx zakai-mandate-ready --origin https://zakai-3uxj.vercel.app
```

**Python (Ed25519 Status List verify — same crypto bar as Node):**

```bash
cd reference/python
pip install -r requirements-sdk.txt
python3 zakai_verify.py --ready --origin https://zakai-3uxj.vercel.app
```

`READY_FOR_PIONEER` requires vectors + cryptographically verified statuslist+jwt.
Without `cryptography`, Python refuses READY (smoke fetch only) so it cannot
overclaim against the Node SDK.

Live JSON twin (same gate the Pioneer wizard and listing API use):

```
GET https://zakai-3uxj.vercel.app/api/mandate/ready
→ { ready_for_pioneer, vectors, status_list }
```

Human UI twin: `/he/institutions/quickstart`

## 1. Read the discovery document (2 min)

```
GET https://zakai-3uxj.vercel.app/.well-known/zakai-mandate.json
```

Note: JWKS URL, verify endpoint, forbidden scopes, revocation / status list.

## 2. Fetch the trust registry (2 min)

```
GET https://zakai-3uxj.vercel.app/.well-known/zakai-trust-registry.json
```

Reject mandates from issuers that are `suspended` or not listed.

## 3. Verify a mandate (5 min)

**Option A — HTTP (CORS-enabled):**

```
POST https://zakai-3uxj.vercel.app/api/mandate/verify
Content-Type: application/json

{ "mandate": "<JWS compact>" }
```

**Option B — SDK (TypeScript, runs in your VPC):**

```bash
# Monorepo path (preferred until npm publish is live):
cd sdk && npm ci && npm run build
# Or, after publish: npm install @zakai/mandate-sdk
```

```ts
import { verifyMandateFromUrl } from "@zakai/mandate-sdk";
import { verifyStatusListFromUrl } from "@zakai/mandate-sdk";
import { verifyMandateWithRegistry } from "@zakai/mandate-sdk/registry";

const claims = await verifyMandateFromUrl(jws, {
  audience: "my-institution-id",
  jwksUri: "https://zakai-3uxj.vercel.app/.well-known/zakai-jwks.json",
  // JWKS is cached 5 minutes by default — set jwksCacheTtlMs: 0 to bypass.
});

const list = await verifyStatusListFromUrl({
  statusListUri: "https://zakai-3uxj.vercel.app/api/mandate/revocations",
  issuer: "https://zakai-3uxj.vercel.app",
  jwksUri: "https://zakai-3uxj.vercel.app/.well-known/zakai-jwks.json",
});
```

**Option C — MCP (for internal AI tooling, after publish):**

```bash
npx zakai-mandate-mcp
# or: cd sdk && npm run mcp
```

## 4. Decide whether to act (3 min)

```
POST https://zakai-3uxj.vercel.app/api/mandate/decide
```

Or offline: `decide()` in `@zakai/mandate-sdk` / `reference/python/zakai_decide.py`.

## 5. Status List (ongoing — cacheable)

```
GET https://zakai-3uxj.vercel.app/api/mandate/revocations
Content-Type: application/statuslist+jwt
Cache-Control: public, max-age=900
```

Fetch every ~15 minutes, verify once with JWKS, then answer revocation **offline**.
Fail closed if the list is expired or unreachable.

## 6. Pioneer (optional, after READY)

1. Open `/he/institutions/leader`
2. Finish JWKS + verify self-checks
3. Opt into the public wall (first three = Pioneer)

Empty wall = honest. Do not invent adopters.

## Related

- Full institutions narrative: `/he/institutions`
- Pipe (Mandate → SavingsProof): `/he/pipe`
- Conformance JSON: `/.well-known/zakai-conformance.json`
- Probe: `POST /api/mandate/conformance/probe`
