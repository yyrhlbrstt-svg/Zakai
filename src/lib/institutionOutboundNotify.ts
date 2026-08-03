import "server-only";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/messaging";
import { isTrackedInstitutionAudience } from "@/lib/institutionAudience";
import {
  appOriginForInstitutionEmails,
  conformanceProbeEmailSection,
} from "@/lib/institutionVerifierOnboardingEmail";

const SUBJECT = "Zakai — new documented consumer outreach (aggregate notice)";

/**
 * When a case actually dispatches to a provider and the mandate targets a
 * registered institution aud, ping their technical contact once per case.
 * No PII — institution opted in via Reference Verifier.
 */
export async function notifyInstitutionOnOutboundSend(mandateAudience: string | null | undefined): Promise<void> {
  const aud = mandateAudience?.trim().toLowerCase();
  if (!aud || !isTrackedInstitutionAudience(aud)) return;

  let verifier: { contactEmail: string; displayNameEn: string } | null = null;
  try {
    verifier = await prisma.referenceVerifier.findUnique({
      where: { institutionId: aud },
      select: { contactEmail: true, displayNameEn: true },
    });
  } catch {
    return;
  }
  if (!verifier) return;

  const origin = appOriginForInstitutionEmails();

  const probeSection = conformanceProbeEmailSection(origin, aud);

  await sendEmail({
    to: verifier.contactEmail,
    subject: SUBJECT,
    body: `Hello ${verifier.displayNameEn} team,

A Zakai consumer case with Mandate audience \`${aud}\` reached outbound dispatch (email sent or queued per environment).

This notice has no customer identity.

${probeSection}

— Zakai network`,
  });
}
