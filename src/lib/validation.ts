import { z } from "zod";
import { normalizeIsraeliMobile } from "./phone";

export const signupSchema = z.object({
  name: z.string().trim().min(2, "nameRequired"),
  email: z.string().trim().toLowerCase().email("invalidEmail"),
  password: z.string().min(8, "weakPassword"),
  phone: z
    .string()
    .trim()
    .refine((v) => normalizeIsraeliMobile(v) !== null, "invalidPhone"),
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
