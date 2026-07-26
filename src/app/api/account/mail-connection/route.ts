import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import {
  connectMailForSavingsProof,
  revokeMailForSavingsProof,
  type MailConnectionProvider,
} from "@/lib/services/savingsVerification";

const providerSchema = z.enum(["gmail", "microsoft"]);

const upsertSchema = z.object({
  provider: providerSchema,
  refreshToken: z.string().min(1),
  accessToken: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  scope: z.string().min(1),
});

/** List the user's connected mail accounts for savings verification. */
export async function GET() {
  const user = await requireUser();
  const connections = await prisma.mailConnection.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      provider: true,
      scope: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ connections });
}

/** Store or update a mail connection. Called after OAuth consent is granted. */
export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = upsertSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalidInput" }, { status: 400 });
  }

  const data = parsed.data;
  await connectMailForSavingsProof({
    userId: user.id,
    provider: data.provider as MailConnectionProvider,
    refreshToken: data.refreshToken,
    accessToken: data.accessToken,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    scope: data.scope,
  });

  return NextResponse.json({ ok: true });
}

/** Revoke a mail connection. */
export async function DELETE(req: Request) {
  const user = await requireUser();
  const body = await req.json().catch(() => null);
  const parsed = providerSchema.safeParse(body?.provider);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalidProvider" }, { status: 400 });
  }

  await revokeMailForSavingsProof(user.id, parsed.data as MailConnectionProvider);
  return NextResponse.json({ ok: true });
}
