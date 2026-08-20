import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { evaluateFacts } from "@/lib/rightsGraph/publicSurface";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const factValue = z.union([
  z.string().max(200),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(200)).max(32),
]);

const schema = z.object({
  // Flat named facts, capped so a caller cannot make us evaluate a novel.
  facts: z
    .record(z.string().regex(/^[a-z_][a-z0-9_]*$/).max(64), factValue)
    .refine((f) => Object.keys(f).length <= 64, "too many facts"),
});

/**
 * Which verified rights apply to these facts — the question every consumer
 * agent has to answer before it can act, answered from encoded, sourced law.
 *
 * Deliberately unauthenticated: this is the free-to-read half of the
 * flywheel. Nothing here acts, spends, or identifies anyone — callers send
 * facts, not identities. Rate-limited to protect CPU, not authority.
 */
export async function POST(req: Request) {
  const limited = await rateLimit("rights-graph-evaluate", clientIp(req), 120, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: CORS });
  }

  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_input",
        hint: 'POST { "facts": { "continuing_transaction": true, ... } } — field names are lower_snake_case.',
      },
      { status: 400, headers: CORS },
    );
  }

  const origin = new URL(req.url).origin;
  return NextResponse.json(evaluateFacts(origin, parsed.data.facts), {
    headers: { "Cache-Control": "no-store", ...CORS },
  });
}
