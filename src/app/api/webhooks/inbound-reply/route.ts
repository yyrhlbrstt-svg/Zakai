import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeProviderReply, executeReplyAction } from "@/lib/services/followup";
import { reportError } from "@/lib/report-error";

export const dynamic = "force-dynamic";

import { AUTHORIZATION_CODE_RE } from "@/lib/codes";

const CODE_RE = AUTHORIZATION_CODE_RE;

interface InboundPayload {
  from: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Webhook for inbound provider replies (e.g. from an email-forwarding service).
 * Finds the case by its authorization code, analyzes the reply with the agent,
 * and executes the next step autonomously when safe.
 *
 * Protected by a shared secret in production: WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && request.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: InboundPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalidPayload" }, { status: 400 });
  }

  const raw = `${payload.subject}\n${payload.text}`;
  const codeMatch = raw.match(CODE_RE);
  if (!codeMatch) {
    return NextResponse.json({ error: "noAuthorizationCode" }, { status: 422 });
  }

  const auth = await prisma.authorization.findUnique({
    where: { code: codeMatch[0] },
    include: { case: { include: { user: { select: { id: true } } } } },
  });
  if (!auth || auth.status !== "ACTIVE") {
    return NextResponse.json({ error: "caseNotFound" }, { status: 404 });
  }

  try {
    const parsed = await analyzeProviderReply({
      caseId: auth.caseId,
      userId: auth.case.user.id,
      replyText: raw,
    });
    const executed = await executeReplyAction({
      caseId: auth.caseId,
      userId: auth.case.user.id,
      parsed,
    });
    return NextResponse.json({ ok: true, parsed, executed });
  } catch (err) {
    await reportError(err, { route: "webhooks-inbound-reply", code: auth.code });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
