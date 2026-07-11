import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { signupSchema, firstError } from "@/lib/validation";
import { normalizeIsraeliMobile } from "@/lib/phone";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  }
  const { name, email, password, phone } = parsed.data;
  const normalizedPhone = normalizeIsraeliMobile(phone)!;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "emailTaken" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone: normalizedPhone,
      passwordHash: await hashPassword(password),
    },
    select: { id: true },
  });

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
