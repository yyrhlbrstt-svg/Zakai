import "server-only";

import { prisma } from "@/lib/prisma";
import { planRetentionActions, type RetentionUserSnapshot } from "@/lib/monopoly/retentionEngine";

export async function loadRetentionSnapshot(userId: string): Promise<RetentionUserSnapshot> {
  const now = Date.now();
  const [
    lastCase,
    openAnalyzedOrApproved,
    openVerifiedReadyToSend,
    openSent,
    savedCount,
    householdBeneficiaryCases,
    upcomingDeadlines,
    openVigilAlerts,
  ] = await Promise.all([
    prisma.case.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.case.count({
      where: { userId, status: { in: ["ANALYZED", "APPROVED"] } },
    }),
    prisma.case.count({
      where: { userId, status: "VERIFIED" },
    }),
    prisma.case.count({
      where: { userId, status: "SENT" },
    }),
    prisma.case.count({
      where: { userId, status: "SAVED" },
    }),
    prisma.case.count({
      where: { userId, NOT: { beneficiaryLabel: "" } },
    }),
    prisma.deadline.count({
      where: {
        userId,
        dueDate: { lte: new Date(now + 14 * 86_400_000) },
        notifiedAt: null,
      },
    }),
    prisma.vigilAlert.count({
      where: {
        userId,
        sentAt: { gte: new Date(now - 30 * 86_400_000) },
      },
    }).catch(() => 0),
  ]);

  const daysSinceLastServerCase = lastCase
    ? Math.floor((now - lastCase.createdAt.getTime()) / 86_400_000)
    : null;

  return {
    daysSinceLastServerCase,
    openAnalyzedOrApproved,
    openVerifiedReadyToSend,
    openSent,
    savedWithoutRecentShare: savedCount > 0,
    householdBeneficiaryCases,
    upcomingDeadlines,
    openVigilAlerts,
    hasAnySaved: savedCount > 0,
  };
}

export async function loadRetentionPlan(userId: string) {
  const snap = await loadRetentionSnapshot(userId);
  return planRetentionActions(snap);
}
