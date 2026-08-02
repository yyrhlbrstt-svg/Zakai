import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/messaging";
import { reportError } from "@/lib/report-error";
import { requireCronAuth } from "@/lib/security/cronAuth";
import { INSTITUTION_INBOUND_DIGEST_SUBJECT } from "@/lib/institutionInboundDigest";
import {
  aggregateInboundPressure,
  isOutboundCaseStatus,
  providerKeysForInstitution,
} from "@/lib/institutionInboundPressure";

export const dynamic = "force-dynamic";

const COOLDOWN_DAYS = 6;
const WEEK_MS = 7 * 86_400_000;

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.MANDATE_ISSUER?.trim() ||
    "https://zakai-3uxj.vercel.app"
  );
}

/**
 * Emails registered Reference Verifier contacts with aggregate Zakai case
 * volume mapped to their institution id — no PII, no sales copy.
 */
export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const cooldown = new Date(Date.now() - COOLDOWN_DAYS * 86_400_000);
  const weekAgo = new Date(Date.now() - WEEK_MS);

  try {
    const verifiers = await prisma.referenceVerifier.findMany({
      select: {
        institutionId: true,
        displayNameEn: true,
        contactEmail: true,
      },
    });

    if (verifiers.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, reason: "no_verifiers" });
    }

    const allCases = await prisma.case.findMany({
      select: { provider: true, status: true, updatedAt: true },
    });

    const pressure = aggregateInboundPressure(
      allCases.map((c) => ({ provider: c.provider, status: c.status })),
    );

    let sent = 0;
    const origin = appOrigin();

    for (const v of verifiers) {
      const recent = await prisma.outbox.findFirst({
        where: {
          toAddress: v.contactEmail,
          subject: INSTITUTION_INBOUND_DIGEST_SUBJECT,
          createdAt: { gt: cooldown },
        },
        select: { id: true },
      });
      if (recent) continue;

      const keys = providerKeysForInstitution(v.institutionId);
      let weekly = 0;
      if (keys.length > 0) {
        const keySet = new Set(keys.map((k) => k.toLowerCase()));
        for (const c of allCases) {
          if (!isOutboundCaseStatus(c.status)) continue;
          if (!keySet.has(c.provider.trim().toLowerCase())) continue;
          if (c.updatedAt >= weekAgo) weekly += 1;
        }
      }

      const total =
        pressure.find((p) => p.institutionId === v.institutionId)?.dispatchedCases ?? 0;

      const body = `Hello ${v.displayNameEn} team,

Weekly Zakai inbound snapshot for institution id \`${v.institutionId}\` (mapped provider keys only — not your full mailroom):

• Last 7 days: ${weekly} consumer cases reached outbound dispatch (SENT / saved / closed)
• All-time documented dispatch count on Zakai: ${total}

Verify readiness wizard: ${origin}/en/institutions/leader
Public pressure API: ${origin}/api/institution/inbound-pressure

Numbers are aggregate; no customer identities. This is not regulatory certification.

— Zakai Mandate network`;

      await sendEmail({
        to: v.contactEmail,
        subject: INSTITUTION_INBOUND_DIGEST_SUBJECT,
        body,
      });
      sent += 1;
    }

    return NextResponse.json({ ok: true, verifiers: verifiers.length, sent });
  } catch (err) {
    await reportError(err, { route: "cron-institution-inbound" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
