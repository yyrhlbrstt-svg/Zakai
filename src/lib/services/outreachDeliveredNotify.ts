import "server-only";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/messaging";
import { pushToUser } from "@/lib/push";
import { providerHebrewName } from "@/lib/providers";
import { proofsInboundAddress } from "@/lib/mandate/document";
import { absoluteLocaleUrl, localeForCountry } from "@/lib/localePath";
import {
  classifyProviderOutreachForNotify,
  outreachDeliveredPush,
  outreachDeliveredUserBody,
  outreachDeliveredUserSubject,
  type OutreachDeliveredKind,
} from "@/lib/outreachDeliveredNotify";

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";
}

/**
 * Tell the case owner a provider letter actually left the system (Outbox SENT).
 * Used by sync send when SMTP accepts immediately, and by the async Outbox
 * worker when QUEUED drains later — never invent "נשלח" for still-queued rows.
 *
 * Returns true when a notify was attempted (email and/or push).
 */
export async function notifyUserProviderOutreachDelivered(
  caseId: string,
  subject: string | null | undefined,
  kindOverride?: OutreachDeliveredKind,
): Promise<boolean> {
  const kind = kindOverride ?? classifyProviderOutreachForNotify(subject);
  if (!kind) return false;

  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      provider: true,
      userId: true,
      user: { select: { id: true, name: true, email: true, country: true } },
    },
  });
  if (!kase?.user?.email) return false;

  const provider = providerHebrewName(kase.provider);
  const proofsAddr = proofsInboundAddress();
  const moneyUrl = absoluteLocaleUrl(
    appBaseUrl(),
    localeForCountry(kase.user.country),
    `/money?case=${caseId}`,
  );

  await sendEmail({
    to: kase.user.email,
    subject: outreachDeliveredUserSubject(kind, provider),
    body: outreachDeliveredUserBody({
      kind,
      name: kase.user.name,
      provider,
      proofsAddr,
      moneyUrl,
    }),
    caseId,
  });

  const push = outreachDeliveredPush({
    kind,
    provider,
    proofsAddr,
    caseId,
  });
  await pushToUser(kase.user.id, push).catch(() => null);
  return true;
}
