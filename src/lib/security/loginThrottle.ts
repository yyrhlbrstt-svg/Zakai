import "server-only";
import { createHash } from "node:crypto";
import { rateLimit, refundRateLimit } from "@/lib/ratelimit";

/**
 * A second throttle on login, keyed to the account rather than the caller.
 *
 * The existing limit is `rateLimit("login", clientIp(request), 10, 600)`, and
 * against the attack that matters it does nothing. Password guessing at any
 * scale is distributed by default — a rented proxy pool, a botnet, or simply a
 * phone toggling airplane mode — and every new IP resets that counter to zero.
 * One account could be guessed against forever, ten tries at a time, and the
 * only trace would be login_failed rows nobody was watching.
 *
 * So the account gets a budget of its own that no amount of IP rotation
 * refills.
 *
 * WHY A WINDOW AND NOT A LOCKOUT
 *
 * A lockout that persists until an admin or an email clears it hands anybody
 * who knows an address the ability to lock its owner out on demand — the
 * control becomes the denial of service. A fixed window recovers by itself,
 * costs an attacker the same, and costs a real person fifteen minutes at
 * worst.
 *
 * WHY ONLY FAILURES COUNT
 *
 * The check increments before the password is verified, because it has to be
 * decided before the expensive comparison runs. A success then refunds it, so
 * somebody who logs in daily never accumulates anything and the budget means
 * what it says: consecutive *failures*.
 *
 * WHY THE EMAIL IS HASHED
 *
 * The key becomes the primary key of a RateLimit row, and a table nobody
 * thinks of as personal data is exactly where personal data goes unnoticed.
 * The hash is stable enough to count against and useless to anybody reading
 * the table.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *
 * It does not tell the caller whether the address exists. The budget is spent
 * against whatever string was submitted, and the refusal is the same 429 an
 * unknown address gets — otherwise the throttle itself would answer the
 * question the login response is careful not to.
 */

/** Consecutive failures allowed per account before the window has to pass. */
export const ACCOUNT_ATTEMPT_LIMIT = 10;

/** Fifteen minutes: long enough to be worthless to a guesser, short enough
 *  that a person who genuinely forgot can go and reset instead of waiting. */
export const ACCOUNT_WINDOW_SECONDS = 15 * 60;

const BUCKET = "login-account";

/**
 * Stable, non-reversible identifier for an email address.
 *
 * Salted with AUTH_SECRET where there is one, so the same address at two
 * deployments does not produce the same key. Falls back to an unsalted digest
 * rather than throwing: this is a privacy measure on a counter, and refusing
 * to rate-limit at all would be the worse failure.
 */
export function accountKey(email: string): string {
  const salt = process.env.AUTH_SECRET ?? "";
  return createHash("sha256")
    .update(`${salt}:login:${email.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
}

/** Spend one attempt. `ok: false` means this account is out of budget. */
export async function claimLoginAttempt(email: string): Promise<{ ok: boolean }> {
  const { ok } = await rateLimit(
    BUCKET,
    accountKey(email),
    ACCOUNT_ATTEMPT_LIMIT,
    ACCOUNT_WINDOW_SECONDS,
  );
  return { ok };
}

/** Give the attempt back — the credentials were right. */
export async function releaseLoginAttempt(email: string): Promise<void> {
  await refundRateLimit(BUCKET, accountKey(email), ACCOUNT_WINDOW_SECONDS);
}
