import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import { normalizeRemindDaysBefore } from "@/lib/deadlines";

/** No plan, no fee — a generous flat cap just to keep this an actual calendar, not a database. */
const MAX_DEADLINES = 40;

const schema = z.object({
  label: z.string().min(1).max(120),
  dueDate: z.string().min(1).max(40),
  remindDaysBefore: z.number().optional(),
});

export async function GET() {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const deadlines = await prisma.deadline.findMany({
    where: { userId: auth.userId },
    orderBy: { dueDate: "asc" },
  });
  return NextResponse.json({ deadlines });
}

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("deadlines-create", auth.userId, 30, 24 * 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const data = parsed.data;

  const dueDate = new Date(data.dueDate);
  if (Number.isNaN(dueDate.getTime())) return badRequest("genericError");

  const count = await prisma.deadline.count({ where: { userId: auth.userId } });
  if (count >= MAX_DEADLINES) return badRequest("deadlineLimit", 403);

  const deadline = await prisma.deadline.create({
    data: {
      userId: auth.userId,
      label: data.label,
      dueDate,
      remindDaysBefore: normalizeRemindDaysBefore(data.remindDaysBefore ?? 14),
    },
  });

  return NextResponse.json({ deadline });
}
