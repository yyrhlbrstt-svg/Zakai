# Mandate adoption — 20–30 minutes (no sales call)

**Goal:** prove on *your* machine that you can verify a Zakai Mandate, then claim Pioneer.

```
Run SDK gate → READY_FOR_PIONEER → Reference Verifier wizard → Pioneer wall
```

Not regulatory certification. Wall stays empty until a real opt-in.

---

## Safety (read once — 60 seconds)

| Guarantee | Meaning |
|-----------|---------|
| **Verify-only SDKs** | No private keys. Cannot issue Mandates. |
| **Inbound-only** | Your system *receives* authority proofs; SDKs do not move money. |
| **Forbidden scopes** | `payment:initiate`, `payment:transfer`, `credit:borrow`, `account:open`, `account:close`, `investment:trade` — always deny. |
| **Fail closed** | Bad signature / wrong audience / expired / forbidden → reject. |

Live discovery: `GET /.well-known/zakai-mandate.json`

---

## Step 1 — Run the gate (~10 min)

Pick **one** stack.

### Node (official `@zakai/mandate-sdk`)

```bash
git clone https://github.com/yyrhlbrstt-svg/Zakai.git
cd Zakai/sdk
npm ci
npm run ready -- --origin https://zakai-3uxj.vercel.app
```

After npm publish: `npx zakai-mandate-ready --origin https://zakai-3uxj.vercel.app`

### Python (official `zakai-mandate`)

```bash
git clone https://github.com/yyrhlbrstt-svg/Zakai.git
cd Zakai/sdk/python
pip install -e '.[crypto]'
zakai-mandate-ready --origin https://zakai-3uxj.vercel.app
```

### Zero-install smoke (not enough for Pioneer alone)

```bash
curl -sS https://zakai-3uxj.vercel.app/api/mandate/ready | jq .
# need: ready_for_pioneer === true  (server-side gate)
```

Pioneer **claim** still requires you to run the wizard after the machine gate; production verify should use the SDK offline against JWKS.

**Success looks like:**

```
authorization vectors: CONFORMANT — N/N passed.
status list: VERIFIED …
READY_FOR_PIONEER
Next: …/institutions/leader
```

---

## Step 2 — Confirm the public twin (~2 min)

```bash
curl -sS https://zakai-3uxj.vercel.app/api/mandate/ready | jq .ready_for_pioneer
# true
```

Must-hit URLs:

- `/.well-known/zakai-jwks.json`
- `/api/mandate/test-vectors`
- `/api/mandate/revocations` (`statuslist+jwt`)
- `POST /api/mandate/verify`

Sample package (does **not** list you as Pioneer):

```bash
curl -sS 'https://zakai-3uxj.vercel.app/api/institution/pilot-package?audience=your-institution-id' | jq .
```

---

## Step 3 — Claim Pioneer / Reference Verifier (~10–15 min)

1. Open https://zakai-3uxj.vercel.app/he/institutions/leader  
2. Click **Run checks** (wizard hits JWKS, verify, inbound receive, `/api/mandate/ready`)  
3. Only when `READY_FOR_PIONEER` → enter institution details → opt into the public wall  
4. Max **3** Pioneer slots. Empty wall = honesty, not a bug.

Human twin of this doc: `/he/institutions/quickstart`

---

## Drop into your code (optional, ~5 min)

**Node**

```ts
import { verifyMandateFromUrl, verifyStatusListFromUrl, FORBIDDEN_SCOPES } from "@zakai/mandate-sdk";

const claims = await verifyMandateFromUrl(jws, {
  audience: "your-institution-slug",
  jwksUri: "https://zakai-3uxj.vercel.app/.well-known/zakai-jwks.json",
});

await verifyStatusListFromUrl({
  statusListUri: "https://zakai-3uxj.vercel.app/api/mandate/revocations",
  issuer: "https://zakai-3uxj.vercel.app",
  jwksUri: "https://zakai-3uxj.vercel.app/.well-known/zakai-jwks.json",
});

// FORBIDDEN_SCOPES — never permit these actions
```

**Python**

```python
from zakai_mandate import verify_mandate_from_url, verify_status_list_from_url, FORBIDDEN_SCOPES

claims = verify_mandate_from_url(
    jws,
    audience="your-institution-slug",
    jwks_uri="https://zakai-3uxj.vercel.app/.well-known/zakai-jwks.json",
)
verify_status_list_from_url(
    status_list_uri="https://zakai-3uxj.vercel.app/api/mandate/revocations",
    issuer="https://zakai-3uxj.vercel.app",
    jwks_uri="https://zakai-3uxj.vercel.app/.well-known/zakai-jwks.json",
)
```

---

## Excuses removed

| Excuse | Answer |
|--------|--------|
| “Need a sales call” | No — public JWKS + vectors + wizard |
| “Can’t move money / too risky” | Forbidden scopes + verify-only SDK |
| “Node only / Python only” | Official packages for both |
| “Don’t trust your servers” | Offline JWKS verify; Status List cacheable |
| “How do we get recognized?” | Pass gate → wizard → Pioneer (max 3) |
| “Docs are a maze” | This file is the whole path |
