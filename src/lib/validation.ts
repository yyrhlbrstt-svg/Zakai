import { z } from "zod";
import { normalizePhone } from "./phone";

/**
 * NIST 800-63B: length matters far more than forced complexity rules, so this
 * stays a length-only minimum — but length alone still lets "12345678" or
 * "password" through, which is exactly the case a real user (and every
 * credential-stuffing bot) will try first. Same complementary control NIST
 * recommends: block the small set of passwords everyone tries.
 */
const COMMON_WEAK_PASSWORDS = new Set([
  "12345678", "123456789", "1234567890", "password", "password1", "passw0rd",
  "qwertyui", "qwerty123", "11111111", "00000000", "87654321", "letmein11",
  "abc12345", "iloveyou1", "admin1234", "welcome1", "zakai1234", "zakaizakai",
  "12341234", "changeme1", "aaaaaaaa", "1q2w3e4r", "asdfghjk",
]);

/**
 * The one place a new password's strength is defined. Shared by signup and by
 * password reset so the two can never drift — a reset path that quietly accepts
 * a weaker password than signup becomes the way in.
 */
export const passwordField = z
  .string()
  .min(8, "weakPassword")
  .refine((v) => !COMMON_WEAK_PASSWORDS.has(v.toLowerCase()), "weakPassword");

export const signupSchema = z.object({
  name: z.string().trim().min(2, "nameRequired"),
  email: z.string().trim().toLowerCase().email("invalidEmail"),
  password: passwordField,
  phone: z
    .string()
    .trim()
    // International: accept any valid E.164 number, not only Israeli ones —
    // Zakai is built to serve users from every country it can help.
    .refine((v) => normalizePhone(v) !== null, "invalidPhone"),
  // ISO-3166 alpha-2 country of signup. Defaults to Israel (the launch market).
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .optional()
    .default("IL"),
  // Optional invite code from a referral link (?ref=...). Ignored if unknown.
  referralCode: z.string().trim().max(64).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("invalidEmail"),
  password: z.string().min(1, "invalidCredentials"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** Flatten the first zod error into a single message key. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "genericError";
}
