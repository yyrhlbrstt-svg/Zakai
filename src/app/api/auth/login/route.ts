import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { loginSchema, firstError } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // Same response for "no user" and "bad password" to avoid user enumeration.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "invalidCredentials" }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
