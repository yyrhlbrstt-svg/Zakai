import { z } from "zod";
import { normalizePhone } from "./phone";

export const signupSchema = z.object({
  name: z.string().trim().min(2, "nameRequired"),
  email: z.string().trim().toLowerCase().email("invalidEmail"),
  password: z.string().min(8, "weakPassword"),
  phone: z
    .string()
    .trim()
    // International: accept any valid E.164 number, not only Israeli ones —
    // Zakai is built to serve users from every country it can help.
    .refine((v) => normalizePhone(v) !== null, "invalidPhone"),
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
