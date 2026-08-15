# Running the loop for real

`npx vitest run` proves functions return the right values. It does not prove a
person can finish anything. Those are different claims, and only the second one
matters to someone trying to get their money back.

This is the setup for making the second claim. It exists because a green suite
of 2,100 tests once shipped a signup screen nobody could get past: the terms
checkbox carried `required`, native constraint validation aborted the submit
before `onSubmit` ran, and the translated error the handler set was never
reachable. Nothing failed. The button simply did nothing, and real people —
the founder's own family — concluded the product did not work.

## Start a real database

The app needs Postgres; there is no SQLite fallback (`schema.prisma` is
Postgres-specific, and the money paths depend on it).

```bash
sudo -u postgres /usr/lib/postgresql/16/bin/initdb -D /var/lib/zakai-pg -U zakai --auth=trust
sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/zakai-pg -o '-p 5433' start
psql -h 127.0.0.1 -p 5433 -U zakai -d postgres -c 'CREATE DATABASE zakai;'
```

Point Prisma at it and create the schema:

```bash
export NEON_DATABASE_URL="postgresql://zakai@127.0.0.1:5433/zakai"
export NEON_DATABASE_URL_UNPOOLED="$NEON_DATABASE_URL"
npx prisma db push
```

## Start the app

```bash
export AUTH_SECRET="local-only-not-a-production-secret"
npm run build && npx next start -p 3000
```

No AI key is needed for the loop check — the paths it walks are deterministic.
Without `SMTP_HOST` nothing leaves the Outbox, which is correct locally: mail
stays `QUEUED` rather than reaching a real provider.

## Walk it

```bash
npm i -D playwright   # once
node scripts/verify-loop.mjs http://127.0.0.1:3000
```

It signs up, scans a statement, and checks that a blocked button says what it
is waiting for. Failure means a real person cannot finish the loop, which
outranks every other kind of failing check in this repo.

Missing Playwright or a missing server report `SKIP`, never a pass. A check
that silently no-ops is worse than no check, because it buys confidence
without earning it.

## Why it is not in CI

It needs a database, a full build, and a browser. Wiring that into the PR
workflow would roughly triple CI time for every typo fix. Run it before
merging anything that touches signup, `/money`, `CheckFlow`, or a vertical's
agent form — the surfaces where "it looked done" has already cost the most.

## Walk it the way a person walks it

`verify-loop.mjs` stops once a scan produces *a next action*. `verify-money-loop.mjs`
goes all the way to a Fee, but does it over HTTP against our own API — it POSTs
to `/api/cases/:id/approve` because it knows that route exists, which is a thing
no person knows. Between them, the journey a stranger actually takes had never
been watched end to end.

```bash
# 1. a mailbox, so the ownership link is real mail and not a database row
node scripts/dev-smtp-sink.mjs &          # 127.0.0.1:2525 → /tmp/zakai-mail

# 2. point the app at it, plus a signing key so a Mandate can be issued
#    (a chargeable saving without one is refused on purpose — see cases.ts)
SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_USER=sink@localhost SMTP_PASS=sink \
MANDATE_SIGNING_KID=zakai-local-1 MANDATE_SIGNING_JWK='<Ed25519 private JWK>' \
npm run build && npx next start -p 3000

# 3. walk it
ZAKAI_MAILDIR=/tmp/zakai-mail npm run verify:journey
```

Generate the local key with:

```bash
node -e 'const{generateKeyPairSync}=require("crypto");
const{privateKey}=generateKeyPairSync("ed25519");
const j=privateKey.export({format:"jwk"});j.kid="zakai-local-1";j.alg="EdDSA";j.use="sig";
console.log(JSON.stringify(j))'
```

In `.env`, single-quote it — the value contains double quotes and both the
shell and dotenv will otherwise mangle it, which shows up as a JWKS endpoint
answering `mandate_keys_not_configured` with no other clue.

### What its states mean

- **OK** — the step was taken from the screen, by finding its own control.
- **ASSISTED** — the ownership link was read out of the Outbox row, because no
  mailbox was given. Not a pass: it proves the message was composed, not that
  it arrives. Set `ZAKAI_MAILDIR` to turn this into a real OK.
- **STUCK** — no control on that screen led onward. The report names the URL
  they were standing on and what was being looked for.

The script never navigates to a URL it was not shown. That rule is the whole
value: allowed to help itself to a known route, it would turn a real dead end
into a passing check.

### Never point it at production

Step 8 sends. With live mail that is a real letter to a real company, carrying
a signed Mandate, on behalf of a person who does not exist — and the run writes
a Case, an Authorization and a SavingsProof into the same rows the public
counters and the outcome graph are computed from. The sink exists precisely so
this never needs production to be believed.
