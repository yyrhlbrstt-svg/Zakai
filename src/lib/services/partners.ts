import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { generateRecommendation } from "@/lib/ai";
import { createCase, CaseError } from "./cases";
import { providerHebrewName, resolveProviderKey } from "@/lib/providers";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";

export class PartnerError extends Error {}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function authenticateApiKey(key: string) {
  const record = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(key) },
  });
  if (!record || record.revokedAt) return null;
  await prisma.apiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });
  return record;
}

export function hasPermission(record: { permissions: string }, permission: string): boolean {
  return record.permissions.split(",").map((p) => p.trim()).includes(permission);
}

interface AnalyzeInput {
  apiKeyId: string;
  provider: string;
  amountShekels: number;
  plan?: string;
  customerName: string;
  locale?: string;
}

export async function partnerAnalyze(input: AnalyzeInput) {
  const providerKey = resolveProviderKey(input.provider);
  const rec = await generateRecommendation({
    providerLabel: providerHebrewName(providerKey),
    amountShekels: input.amountShekels,
    plan: input.plan ?? "",
    locale: input.locale ?? "he",
    customerName: input.customerName,
  });
  return {
    provider: providerKey,
    strategy: rec.strategy,
    targetShekels: rec.targetShekels,
    marketLowShekels: rec.marketLowShekels,
    marketHighShekels: rec.marketHighShekels,
    draftMessage: rec.draftMessage,
    source: rec.source,
  };
}

interface ClaimInput {
  apiKeyId: string;
  partnerRef?: string;
  userId: string;
  provider: string;
  amountShekels: number;
  plan?: string;
  customerName: string;
  locale?: string;
}

export async function partnerClaim(input: ClaimInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, name: true, plan: true },
  });
  if (!user) throw new PartnerError("USER_NOT_FOUND");

  const activeCount = await prisma.case.count({
    where: { userId: input.userId, status: { in: [...ACTIVE_CASE_STATUSES] } },
  });
  if (!canOpenCase(user.plan, activeCount)) throw new PartnerError("CASE_LIMIT");

  const providerKey = resolveProviderKey(input.provider);
  const rec = await generateRecommendation({
    providerLabel: providerHebrewName(providerKey),
    amountShekels: input.amountShekels,
    plan: input.plan ?? "",
    locale: input.locale ?? "he",
    customerName: input.customerName || user.name,
  });

  const kase = await createCase({
    userId: input.userId,
    provider: providerKey,
    amountShekels: input.amountShekels,
    plan: input.plan ?? "",
    strategy: rec.strategy,
    targetShekels: rec.targetShekels,
    marketLowShekels: rec.marketLowShekels,
    marketHighShekels: rec.marketHighShekels,
    draftMessage: rec.draftMessage,
  });

  await prisma.partnerCaseLink.create({
    data: {
      partnerId: input.apiKeyId,
      caseId: kase.id,
      partnerRef: input.partnerRef,
    },
  });

  return {
    caseId: kase.id,
    partnerRef: input.partnerRef ?? null,
    provider: providerKey,
    strategy: rec.strategy,
    targetShekels: rec.targetShekels,
    marketLowShekels: rec.marketLowShekels,
    marketHighShekels: rec.marketHighShekels,
    draftMessage: rec.draftMessage,
    source: rec.source,
    status: kase.status,
  };
}

export async function partnerCaseStatus(apiKeyId: string, caseId: string) {
  const link = await prisma.partnerCaseLink.findFirst({
    where: { partnerId: apiKeyId, caseId },
    include: { case: { include: { savingsProof: true, fee: true } } },
  });
  if (!link) throw new PartnerError("NOT_FOUND");
  const kase = link.case;
  return {
    caseId: kase.id,
    partnerRef: link.partnerRef,
    status: kase.status,
    provider: kase.provider,
    amountOriginalShekels: kase.amountOriginal / 100,
    targetShekels: kase.targetAmount / 100,
    savingMonthlyShekels: kase.savingsProof ? kase.savingsProof.savingMonthly / 100 : null,
    feeShekels: kase.fee ? kase.fee.amount / 100 : null,
    feeStatus: kase.fee ? kase.fee.status : null,
  };
}
