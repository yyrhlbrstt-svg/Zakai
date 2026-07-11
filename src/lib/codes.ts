import { createHash, randomInt } from "crypto";

/** Cryptographically-random numeric OTP (default 6 digits) for SMS ownership. */
export function generateNumericCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) out += randomInt(0, 10).toString();
  return out;
}

/** SHA-256 hex of an OTP. We never persist the code itself. */
export function hashCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

/**
 * Human-verifiable authorization code, e.g. ZK-7Q4K-2M9P.
 * Uses a Crockford-style alphabet with no ambiguous characters (no O/0/I/1),
 * so a provider rep can read it aloud or type it from the document reliably.
 */
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateAuthorizationCode(): string {
  const group = () =>
    Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]).join("");
  return `ZK-${group()}-${group()}`;
}

/** Constant-time-ish comparison for hashed OTP checks. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
