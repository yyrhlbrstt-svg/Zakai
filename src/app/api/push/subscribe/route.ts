import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { publicVapidKey } from "@/lib/push";

const schema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(10).max(100),
  }),
});

/** Return the public VAPID key the client needs to subscribe. */
export async function GET() {
  const key = publicVapidKey();
  if (!key) return NextResponse.json({ ok: false, configured: false });
  return NextResponse.json({ ok: true, configured: true, publicKey: key });
}

/** Upsert a browser push subscription for the logged-in user. */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  const ua = request.headers.get("user-agent")?.slice(0, 200) || "";

  await prisma.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: {
      userId: auth.userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: ua,
    },
    update: {
      userId: auth.userId,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: ua,
    },
  });

  return NextResponse.json({ ok: true });
}

/** Remove a subscription (user turned notifications off). */
export async function DELETE(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
  if (!endpoint) return badRequest("genericError");

  await prisma.pushSubscription.deleteMany({
    where: { userId: auth.userId, endpoint },
  });
  return NextResponse.json({ ok: true });
}
