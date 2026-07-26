import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  analyzeProviderReply,
  executeReplyAction,
  type ParsedProviderReply,
} from "./followup";
import { createCase } from "./cases";
import { createAuthorization } from "./authorization";
import { hashPassword } from "@/lib/auth/password";

async function makeUserAndCase() {
  const user = await prisma.user.create({
    data: {
      email: `fu-${Date.now()}@example.com`,
      passwordHash: await hashPassword("password123"),
      name: "Test User",
      phone: "+972501234567",
    },
  });
  const kase = await createCase({
    userId: user.id,
    provider: "cellcom",
    amountShekels: 100,
    plan: "",
    strategy: "test",
    targetShekels: 82,
    draftMessage: "please discount",
  });
  await prisma.case.update({
    where: { id: kase.id },
    data: { status: "SENT", ownershipVerifiedAt: new Date() },
  });
  const auth = await createAuthorization(kase.id);
  return { user, kase, auth };
}

describe("followup agent", () => {
  beforeEach(async () => {
    await prisma.case.deleteMany();
    await prisma.user.deleteMany();
  });

  it("parses a saving-accepted reply", async () => {
    const { user, kase } = await makeUserAndCase();
    const parsed = await analyzeProviderReply({
      caseId: kase.id,
      userId: user.id,
      replyText: "שלום, אישרנו הנחה. הסכום החדש שלך הוא 85 ש\"ח לחודש.",
    });
    expect(parsed.outcome).toBe("saving_accepted");
    expect(parsed.newAmountShekels).toBe(85);
    expect(parsed.suggestedAction).toBe("record_saving");
  });

  it("parses a rejected reply and suggests follow-up", async () => {
    const { user, kase } = await makeUserAndCase();
    const parsed = await analyzeProviderReply({
      caseId: kase.id,
      userId: user.id,
      replyText: "לצערנו איננו יכולים להציע הנחה כרגע.",
    });
    expect(parsed.outcome).toBe("rejected");
    expect(parsed.suggestedAction).toBe("send_followup");
  });

  it("parses a needs-info reply", async () => {
    const { user, kase } = await makeUserAndCase();
    const parsed = await analyzeProviderReply({
      caseId: kase.id,
      userId: user.id,
      replyText: "אנא שלחו העתק תעודת זהות וחשבונית אחרונה.",
    });
    expect(parsed.outcome).toBe("needs_info");
    expect(parsed.suggestedAction).toBe("ask_user");
  });

  it("records saving autonomously when outcome is saving_accepted", async () => {
    const { user, kase } = await makeUserAndCase();
    const parsed: ParsedProviderReply = {
      outcome: "saving_accepted",
      newAmountShekels: 85,
      summaryHe: "הספק אישר הנחה.",
      suggestedAction: "record_saving",
    };
    const result = await executeReplyAction({ caseId: kase.id, userId: user.id, parsed });
    expect(result.action).toBe("recorded_saving");

    const updated = await prisma.case.findUnique({
      where: { id: kase.id },
      include: { savingsProof: true, fee: true },
    });
    expect(updated?.status).toBe("SAVED");
    expect(updated?.savingsProof?.newAmount).toBe(8500);
  });
});
