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
