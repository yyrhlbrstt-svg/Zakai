import { NextResponse } from "next/server";
import { z } from "zod";
import { completePasswordReset } from "@/lib/services/passwordReset";
import { passwordField } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";

const schema = z.object({
  token: z.string().min(10).max(200),
  password: passwordField,
});

export async function POST(request: Request) {
  const limited = await rateLimit("password_reset_submit", clientIp(request), 20, 900);
  if (!limited.ok) {
    return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "weakPassword" }, { status: 400 });
  }

  try {
    const outcome = await completePasswordReset(parsed.data.token, parsed.data.password);
    if (outcome === "ok") return NextResponse.json({ ok: true });
    // "expired" and "used" stay distinct from "invalid": they mean the link was
    // genuinely ours, so the honest instruction is "ask for a new one" rather
    // than "that link is wrong".
    return NextResponse.json({ error: `reset_${outcome}` }, { status: 400 });
  } catch (err) {
    await reportError(err, { route: "password/reset" });
    return NextResponse.json({ error: "genericError" }, { status: 500 });
  }
}
