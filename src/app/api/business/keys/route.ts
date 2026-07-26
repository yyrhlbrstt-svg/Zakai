import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api";

const API_KEY_BYTES = 32;

const createSchema = z.object({
  name: z.string().min(1).max(120),
  permissions: z.string().max(200).default("analyze"),
  webhookUrl: z.string().url().optional(),
});

/**
 * Admin endpoint for creating B2B API keys.
 * In production this should be gated to internal admins only; for now it
 * requires an authenticated user as a basic barrier.
 */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalidInput" }, { status: 400 });
  }

  const key = `zak_${crypto.randomBytes(API_KEY_BYTES).toString("base64url")}`;
  const keyHash = crypto.createHash("sha256").update(key).digest("hex");

  await prisma.apiKey.create({
    data: {
      name: parsed.data.name,
      keyHash,
      permissions: parsed.data.permissions,
      webhookUrl: parsed.data.webhookUrl,
    },
  });

  return NextResponse.json({ ok: true, key, name: parsed.data.name });
}

/** List existing B2B API keys (without secrets). */
export async function GET() {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      permissions: true,
      rateLimit: true,
      revokedAt: true,
      createdAt: true,
      lastUsedAt: true,
      webhookUrl: true,
    },
  });

  return NextResponse.json({ keys });
}
