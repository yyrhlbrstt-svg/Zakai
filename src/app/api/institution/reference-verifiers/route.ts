import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import {
  authorizationVectorsConformant,
  isValidInstitutionSlug,
  serverSideReadinessOk,
} from "@/lib/referenceVerifier";
import { sendVerifierWelcomeEmail } from "@/lib/institutionVerifierOnboardingEmail";

export const dynamic = "force-dynamic";

const LIST_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=120",
};

export async function GET() {
  const rows = await prisma.referenceVerifier.findMany({
    orderBy: { listedAt: "asc" },
    take: 50,
  });
  return NextResponse.json(
    {
      ok: true,
      count: rows.length,
      leaders: rows.map((r) => ({
        institutionId: r.institutionId,
        displayNameHe: r.displayNameHe,
        displayNameEn: r.displayNameEn,
        tier: r.tier,
        listedAt: r.listedAt.toISOString(),
      })),
    },
    { headers: LIST_CORS },
  );
}

const schema = z.object({
  institutionId: z.string().min(3).max(48),
  displayNameHe: z.string().min(2).max(120),
  displayNameEn: z.string().min(2).max(120),
  contactEmail: z.string().email().max(200),
  clientCompletedChecks: z.literal(true),
});

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.MANDATE_ISSUER?.trim() ||
    "https://zakai-3uxj.vercel.app"
  );
}

export async function POST(req: Request) {
  const limited = await rateLimit("reference-verifier-register", clientIp(req), 8, 86400);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const institutionId = parsed.data.institutionId.trim().toLowerCase();
  if (!isValidInstitutionSlug(institutionId)) {
    return NextResponse.json({ error: "invalid_institution_id" }, { status: 400 });
  }

  const platformOk = await serverSideReadinessOk(appOrigin());
  if (!platformOk) {
    return NextResponse.json({ error: "platform_readiness_unavailable" }, { status: 503 });
  }

  // Passing vectors is the only claim that means "we can verify Mandates."
  // Client checkboxes alone made false Pioneer listings possible.
  const vectors = authorizationVectorsConformant();
  if (!vectors.ok) {
    return NextResponse.json(
      {
        error: "vectors_not_conformant",
        total: vectors.total,
        failed: vectors.failed.slice(0, 5),
        hint: "Run npx zakai-mandate-ready (or python3 reference/python/zakai_verify.py --ready) before registering.",
      },
      { status: 503 },
    );
  }

  const existingCount = await prisma.referenceVerifier.count();
  const tier = existingCount < 3 ? "pioneer" : "reference";

  try {
    await prisma.referenceVerifier.create({
      data: {
        institutionId,
        displayNameHe: parsed.data.displayNameHe.trim(),
        displayNameEn: parsed.data.displayNameEn.trim(),
        contactEmail: parsed.data.contactEmail.trim().toLowerCase(),
        tier,
      },
    });
  } catch {
    return NextResponse.json({ error: "already_listed" }, { status: 409 });
  }

  void sendVerifierWelcomeEmail({
    institutionId,
    displayNameEn: parsed.data.displayNameEn.trim(),
    contactEmail: parsed.data.contactEmail.trim().toLowerCase(),
    tier,
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    institutionId,
    tier,
    vectorsPassed: vectors.total,
    publicUrl: `${appOrigin()}/he/institutions/leaders`,
    note: "Listed only after platform endpoints + authorization vectors pass server-side. Not regulatory certification.",
  });
}
