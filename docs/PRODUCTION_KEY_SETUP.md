# Production setup — mandate signing key and self-addressing

Written the night of 2026-08-22, for doing by hand tomorrow. The Vercel CLI is
not installed in the agent container, so every step here is the dashboard.

Nothing in this file is a secret. The private key is deliberately absent.

---

## 0. Before anything: does a key already exist?

```bash
curl -s https://zakai-3uxj.vercel.app/.well-known/zakai-jwks.json
```

| Response | What it means | What to do |
|---|---|---|
| `{"error":"mandate_keys_not_configured","keys":[]}` (503) | No key. | This is a first install. Continue to §1. |
| A key with a `kid` | A key is already live. | This is a **rotation**, not an install. Read §4 first. |

A rotation is free only while no unexpired mandate was signed with the old key.
`Authorization` being empty means nothing is in force, so nothing can break.

---

## 1. Generate the key — on your own machine, not in a container

```bash
node scripts/generate-mandate-key.mjs zakai-2026-2
```

Run it locally and keep the output on your laptop. A private key that never
leaves the machine that made it is the only kind with no transfer step to get
wrong.

The script writes nothing to disk on purpose. Redirect it yourself:

```bash
umask 077
node scripts/generate-mandate-key.mjs zakai-2026-2 > ~/.zakai-keys-mandate.env
chmod 600 ~/.zakai-keys-mandate.env
```

It prints three things. You need the first two:

- `MANDATE_SIGNING_KID=zakai-2026-2`
- `MANDATE_SIGNING_JWK='{...}'` — **the private key**
- a pretty-printed public JWKS — reference only; the app derives this itself

---

## 2. The four variables, in the Vercel dashboard

**vercel.com → project `zakai-3uxj` → Settings → Environment Variables → Add New**

| Name | Value | Notes |
|---|---|---|
| `MANDATE_SIGNING_JWK` | the JSON from the generator | turn on **Sensitive** |
| `MANDATE_SIGNING_KID` | `zakai-2026-2` | see the name warning below |
| `MANDATE_ISSUER` | `https://zakai-3uxj.vercel.app` | must equal the public origin exactly |
| `NEXT_PUBLIC_APP_URL` | `https://zakai-3uxj.vercel.app` | check whether it is already set before adding |

Tick **Production** on each. Check the existing list first — if a variable is
already there with the right value, leave it alone.

### ⚠️ Two ways to get this wrong, both of which look like "no key at all"

**The quotes.** The generator prints:

```
MANDATE_SIGNING_JWK='{"crv":"Ed25519","d":"…"}'
```

The single quotes are **shell syntax**. Paste only what is *between* them —
starting at `{` and ending at `}`. With the quotes included, `JSON.parse` throws,
`loadSigningKeyFromEnv` throws `MandateKeyUnavailableError`, and the app behaves
**identically** to having no key configured: JWKS returns 503, mandates stop
being issued, and no error names the real cause.

**The variable name.** It is `MANDATE_SIGNING_KID` — *not*
`MANDATE_SIGNING_JWK_KID`. Verified in `src/lib/mandate/mandate.ts:431`. A
misnamed variable produces the same silent nothing.

### Sensitive

The **Sensitive** toggle makes the value write-only: nobody, including you, can
read it back from the dashboard or the CLI afterwards. That is correct for a
signing key — and it means your local copy is the only copy. Do not lose it.

---

## 3. Redeploy, then verify

Environment variables apply to **new builds only**. Setting them changes nothing
until you redeploy.

**Deployments → the most recent one → ⋯ → Redeploy.**

Then, in order:

```bash
# 1. The public key is published, and the private half is not.
curl -s https://zakai-3uxj.vercel.app/.well-known/zakai-jwks.json
```
- `keys[0].kid` must be `zakai-2026-2`
- `keys[0].x` must equal the `x` your generator printed
- there must be **no** `d` field — if there is one, stop and rotate immediately

```bash
# 2. The app agrees it is configured.
curl -s https://zakai-3uxj.vercel.app/api/health
```

```bash
# 3. The site still boots — this is the NEXT_PUBLIC_APP_URL guard.
curl -s -o /dev/null -w "%{http_code}\n" https://zakai-3uxj.vercel.app/he/verify
```
`200` is correct. A `500` here means `NEXT_PUBLIC_APP_URL` is missing or
malformed; the deployment log will name it in one sentence. That guard is
deliberate — see §5.

---

## 4. If a key was already live (rotation)

Verifiers try every key in the published JWKS, so an overlap costs nothing and
removing the old key early invalidates credentials still legitimately in force.

If `Authorization` is empty, there is nothing in force — swap directly.

Whatever you do, **do not reuse a `kid` for a different key**. Two different
keys sharing `kid: zakai-2026-2` cannot be told apart by name; only the `x` value
distinguishes them, and only if someone thinks to look.

---

## 5. What turning the key on changes

Two behaviours flip the moment `loadSigningKeyFromEnv()` starts succeeding.

**Dispatch stops being forgiving.** Today, with no key, `sendOutreach` takes a
soft path and sends a human authorization document alone. With a key present, a
machine mandate becomes mandatory on every SENT; if issuance fails for any
reason the case rolls back `SENT → VERIFIED` and raises `MANDATE_REQUIRED`
(`src/lib/services/cases.ts:275`). This is the intended state — just know it is
a hard gate, not a preference.

**Recording a saving needs the mandate.** `recordSaving` refuses to bill a
chargeable fee against an authorization with no `mandateJti`
(`cases.ts:451`), because silently waiving the fee would hide that authority was
never bound. Without a signing key, a real saving cannot be recorded as
chargeable at all.

---

## 6. `OUTBOX_ASYNC` — confirm it is absent

In **Settings → Environment Variables**, confirm there is no `OUTBOX_ASYNC`.

Default is off (`process.env.OUTBOX_ASYNC === "true"`, strict). Set to `true`,
mail and SMS are only queued, and `vercel.json` drains the queue once a day at
11:00. The OTP lives 10 minutes and the ownership magic link 15 minutes — both
would expire roughly a hundred times over before delivery, with the Outbox
reporting `SENT` and no error anywhere.

Absent is better than `false`: it leaves no trap for whoever edits this next.

---

## 7. Still outstanding after all of the above

SMTP. Four variables plus one that is not optional:

```
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend          # the literal string, not an address
SMTP_PASS=re_…            # the Resend API key
SMTP_FROM=Zakai <no-reply@yourdomain>
```

`SMTP_FROM` is mandatory with Resend, not cosmetic: the fallback chain is
`SMTP_FROM || SMTP_USER || "no-reply@localhost"`, and `SMTP_USER` here is the
word `resend`, which is not an email address. Every message would be rejected.

Requires a domain you control with SPF and DKIM published. That is the step with
real lead time — start it first.

Then:

```bash
# preflight reads process.env ONLY — it does not load .env files.
# Run it bare and it reports everything as missing, which tells you nothing.
set -a; . ./.env.production.local; set +a
node scripts/preflight.mjs

npm run send-test-mail <your address>
```

`send-test-mail` separates connect / authenticate / send, so a wrong password
and a wrong hostname do not look like the same failure. Read its warning about
spam placement before drawing conclusions from the first real letter: a demand
that lands in a company's spam folder is indistinguishable from a company that
ignored you, and that is the one wrong conclusion this whole experiment must
not produce.
