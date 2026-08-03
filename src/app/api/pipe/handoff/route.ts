import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import {
  buildHandoffUrl,
  buildZakaiPipeDocument,
  isPipeDoor,
} from "@/lib/pipe/zakaiPipe";

export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const schema = z.object({
  agent: z.string().min(1).max(64),
  door: z.string().min(1).max(64).default("money"),
  locale: z.enum(["he", "en"]).default("he"),
  campaign: z.string().max(80).optional(),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json(
    {
      ok: true,
      post: `${origin}/api/pipe/handoff`,
      body: { agent: "your-agent-name", door: "money|cancel|cancel/universal|…", locale: "he|en" },
      doors: buildZakaiPipeDocument(origin).doors,
    },
    { headers: CORS },
  );
}

/**
 * Foreign-agent entry to the pipe — returns an attributed consumer URL.
 * User must still approve / verify / send; LLM never executes.
 */
export async function POST(req: Request) {
  const limited = await rateLimit("pipe-handoff", clientIp(req), 60, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: CORS });
  }

  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "missing_fields", need: ["agent"], doors: buildZakaiPipeDocument(new URL(req.url).origin).doors },
      { status: 400, headers: CORS },
    );
  }

  if (!isPipeDoor(parsed.data.door)) {
    return NextResponse.json(
      {
        error: "unknown_door",
        doors: buildZakaiPipeDocument(new URL(req.url).origin).doors,
      },
      { status: 400, headers: CORS },
    );
  }

  const origin = new URL(req.url).origin;
  const url = buildHandoffUrl({
    origin,
    locale: parsed.data.locale,
    door: parsed.data.door,
    agent: parsed.data.agent,
    campaign: parsed.data.campaign,
  });

  return NextResponse.json(
    {
      ok: true,
      pipe: "zakai-pipe",
      url,
      law: "LLM proposes; user executes Mandate send on Zakai. Never claim a filing that was only drafted.",
      manifest: `${origin}/.well-known/zakai-pipe.json`,
    },
    { headers: CORS },
  );
}
