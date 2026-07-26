import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bodySchema = z.object({
  ageGroup: z.enum(["18_24", "25_44", "45_66", "67_plus"]),
  employment: z.enum(["employee", "self_employed", "unemployed", "student", "soldier", "retired"]),
  children: z.number().int().min(0).max(20).default(0),
  childrenUnder6: z.number().int().min(0).max(20).default(0),
  renting: z.boolean().default(false),
  lowIncome: z.boolean().default(false),
  newImmigrant: z.boolean().default(false),
  dischargedSoldier: z.boolean().default(false),
  reservist: z.boolean().default(false),
  disability: z.boolean().default(false),
});

/** Upsert the user's rights profile so the assistant can personalize nudges. */
export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_profile" }, { status: 400 });
  }

  const data = parsed.data;
  await prisma.userRightsProfile.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });

  return NextResponse.json({ ok: true });
}
