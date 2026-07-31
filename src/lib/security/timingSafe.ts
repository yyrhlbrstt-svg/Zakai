import { createHash, timingSafeEqual } from "crypto";

/**
 * Constant-time string equality for comparing a caller-supplied credential
 * against a server secret — a Bearer token, an API key, a webhook secret.
 *
 * `===` on the raw strings returns as soon as it finds the first mismatched
 * character, so the time a request takes leaks how many leading characters of
 * the guess were correct. Enough requests, measured precisely enough, recover
 * the secret one byte at a time without ever needing to see it. Hashing both
 * sides first removes the length signal too: `timingSafeEqual` requires equal
 * lengths, and two fixed-size digests are always the same length regardless
 * of how long the original strings were.
 */
export function secretsMatch(provided: string, expected: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(provided, "utf8").digest(),
    createHash("sha256").update(expected, "utf8").digest(),
  );
}
