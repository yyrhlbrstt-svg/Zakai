import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/api";
import { saveProfileToAccount } from "@/lib/vigil/run";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  ageGroup: z.enum(["18_24", "25_44", "45_66", "67_plus"]),
  employment: z.enum(["employee", "self_employed", "unemployed", "student", "soldier", "retired"]),
  children: z.number().int().min(0).max(20),
  childrenUnder6: z.number().int().min(0).max(20),
  renting: z.boolean(),
  lowIncome: z.boolean(),
  newImmigrant: z.boolean(),
  dischargedSoldier: z.boolean(),
  reservist: z.boolean(),
  disability: z.boolean(),
  // Optional facts. `z.object` strips unknown keys, so anything missing here is
  // silently dropped on its way to the account — the device keeps it, the
  // server copy quietly does not, and the Vigil then reasons about a person it
  // knows less about than the screen does. Every field added to RightsProfile
  // has to be added here too, and this comment exists because the first four
  // were not.
  hasMortgage: z.boolean().optional(),
  hasCarLoan: z.boolean().optional(),
  spendsForeignCurrency: z.boolean().optional(),
  holdsSecurities: z.boolean().optional(),
  specialNeedsChild: z.boolean().optional(),
  withdrewProvidentFund: z.boolean().optional(),
  soldProperty: z.boolean().optional(),
  livesInEligibleTown: z.boolean().optional(),
  pastEmployers: z.number().int().min(0).max(50).optional(),
});

/**
 * Mirror the device profile onto the account, so the Vigil can run while the
 * app is closed.
 *
 * Authenticated and opt-in by construction: this is only ever called by someone
 * who already chose to have an account, and the device copy remains the only
 * copy for everyone else. The schema is exhaustive rather than passthrough — a
 * profile is read by eligibility rules, and an unexpected field arriving from a
 * client is either a bug or an attempt to steer them.
 */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("vigil_profile", clientIp(request), 60, 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  await saveProfileToAccount(auth.userId, parsed.data);
  return NextResponse.json({ ok: true });
}
