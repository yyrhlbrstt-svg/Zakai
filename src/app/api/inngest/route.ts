import type { NextRequest } from "next/server";
import { serve } from "inngest/next";
import { inngest } from "@/lib/workflow/inngest";
import { workflowFunctions } from "@/lib/workflow/caseWorkflow";

/**
 * The endpoint Inngest calls to run each step.
 *
 * Registered whether or not the durable path is switched on: Inngest needs to
 * be able to introspect the function list to sync it, and an endpoint that
 * 404s until a flag flips makes turning the flag on a two-step operation with
 * a confusing failure in the middle. With no events being sent, a registered
 * function simply never runs.
 *
 * The signing key is what makes this safe to leave mounted: Inngest signs
 * every request, and the SDK reads INNGEST_SIGNING_KEY from the environment
 * itself (it is a property of the client in v4, not of this handler). Without
 * it the SDK rejects unsigned callers rather than executing whatever arrives.
 */
const handler = serve({
  client: inngest,
  functions: workflowFunctions,
});

/**
 * Fail closed, and say why.
 *
 * Unconfigured, the SDK answers every request with a bare
 * `internal_server_error`, which is indistinguishable from a real fault and
 * sends whoever is debugging it looking for a bug that does not exist. Every
 * other not-yet-wired surface in this codebase says so explicitly — the cron
 * endpoints 503 without CRON_SECRET, the inbound-email route 503s without its
 * secret — so this does too.
 */
function notConfigured(): Response {
  return Response.json(
    {
      ok: false,
      error: "inngest_not_configured",
      detail:
        "INNGEST_SIGNING_KEY and INNGEST_EVENT_KEY are not set. The durable " +
        "workflow is registered but inert; case progression runs on the " +
        "existing cron path.",
    },
    { status: 503 },
  );
}

const configured = () => Boolean(process.env.INNGEST_SIGNING_KEY?.trim());

type Ctx = { params: Promise<Record<string, string | string[]>> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return configured() ? handler.GET(req, ctx) : notConfigured();
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return configured() ? handler.POST(req, ctx) : notConfigured();
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return configured() ? handler.PUT(req, ctx) : notConfigured();
}
