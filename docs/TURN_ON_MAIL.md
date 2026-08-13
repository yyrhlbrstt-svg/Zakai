# Turning on outbound mail — without a domain

## The short answer to "we don't have a domain, is this even possible?"

Yes. Today, in about ten minutes, for nothing.

You do not need a domain, a company, a signature, or anyone's permission. You
need a Gmail account and a thing Google calls an App Password.

The reason it works without a domain is that you will not be *pretending* to
send from a domain. You will be sending as `yourname@gmail.com`, which is an
address you genuinely control, so there is nothing for a receiving mail server
to be suspicious of. The moment you invent a From address on a domain you have
not configured, every message starts arriving with a security warning — and the
people seeing that warning are the ones being asked to trust us with their
money. `src/lib/messaging.ts` falls back to `SMTP_USER` when `SMTP_FROM` is
unset, which is exactly the safe default. **Leave `SMTP_FROM` unset.**

## Why this is the first thing, ahead of everything else

Nothing about the consumer product works until this is on, and this is not an
opinion — it is what the code does:

1. `recordSaving` refuses unless the case status is `SENT`
   (`src/lib/services/cases.ts`).
2. Sending refuses unless `ownershipVerifiedAt` is set (same file).
3. Ownership is verified by an SMS code **or** an emailed magic link
   (`src/lib/services/ownership.ts`). With no SMTP and no SMS gateway, neither
   is ever delivered.

So: no mail → no verified owner → no case ever reaches SENT → no SavingsProof
and no Fee can exist, for anyone, ever. Every other improvement is polish on a
loop that cannot close.

The app's own priority list agrees: `src/lib/monopoly/gravityLoop.ts` scores
SMTP `priority: 1, blocksMonopoly: true`, and payments `priority: 99,
blocksMonopoly: false`.

## Step by step

**1. Turn on 2-Step Verification on the Google account.**
myaccount.google.com → Security → 2-Step Verification. App Passwords do not
exist as an option until this is on. This is the step people get stuck at.

**2. Create an App Password.**
myaccount.google.com/apppasswords → name it "Zakai" → Google shows sixteen
characters in four groups. Copy it. It is shown once.

It is *not* your Google password. Gmail refuses ordinary account passwords over
SMTP and answers with a "Username and Password not accepted" error that reads
like the password is wrong when it is merely the wrong kind.

**3. Set five variables.**

Locally, in `.env.local`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=abcdefghijklmnop     # the 16 characters, spaces removed
# SMTP_FROM — deliberately left unset. See above.
```

In production, the same five in the Vercel project's Environment Variables,
then **redeploy** — environment changes do not reach a build that already
exists.

**4. Prove it actually sends.**

```
npm run mail:check
```

This is not the same as `npm run preflight`. Preflight reports whether the
variables are *present*; present is not working. `mail:check` opens a real
connection with the real credentials and sends a real message, and names the
actual cause when it fails — wrong kind of password, unreachable host, blocked
port, mismatched From domain.

Then open the inbox and confirm it arrived, spam folder included. A server
accepting a message is not the same as a person receiving one.

Note: many networks and hosting sandboxes block outbound port 587 entirely.
If `mail:check` times out, try it from your own machine before assuming the
credentials are wrong.

**5. Walk the loop once, as a person.**

Sign up, open a case, ask for the ownership code, and confirm it arrives.
`npm run verify:loop` covers the browser path but cannot see your inbox.

## What Gmail costs you

- **~500 recipients a day** on a free account. Not a constraint at the volume
  where this matters; it becomes one at roughly the point where a proper
  sending service is worth paying for.
- **The From address is a gmail.com address.** For a consumer claim this is
  arguably correct — it is a person's own claim being sent on their behalf, not
  a corporation's bulk mail — but it does look like an individual, because it
  is one.
- **No custom domain reputation to build or ruin.** Google's reputation carries
  the message. That is a real advantage on day one and a ceiling later.

## When you outgrow it

A sending service (Resend, Postmark, SES) plus a domain, with SPF and DKIM
published. Nothing in the app changes except the same five variables — the
transport is one `createTransport` call in `src/lib/messaging.ts` and one in
`src/lib/workers/outboxDeliver.ts`, both driven entirely by environment.

Do not do this first. It costs money and a day, and it fixes a problem you do
not have yet.
