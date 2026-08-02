import { NextResponse } from "next/server";
import { secretsMatch } from "./timingSafe";

/**
 * The one gate in front of every cron endpoint.
 *
 * These routes are not read-only: they email real users (nudges, monthly
 * digest), send follow-ups to providers in users' names (Mandate-backed), and
 * mutate live experiment state (evolve). Before this helper existed each route
 * checked CRON_SECRET only *when set* — so a production deployment that never
 * configured the secret served every one of them to anyone on the internet,
 * and that was exactly the state production was found in.
 *
 * Fail-closed by design:
 *  - CRON_SECRET set   → require the exact Bearer token (constant-time compare).
 *    Vercel sends it automatically on every cron invocation once the env var
 *    exists, so setting the variable is the entire integration.
 *  - CRON_SECRET unset → in production, refuse with 503 and say why. A cron
 *    that silently stops is a mystery; a 503 with "cron_secret_not_configured"
 *    is a one-line fix. Vercel's own docs are explicit that the spoofable
 *    headers (user-agent, x-vercel-cron-schedule) must not be used as the
 *    security boundary, so there is no safe "detect the platform" fallback.
 *  - Outside production (dev, tests) → open, so `curl localhost` still works.
 *
 * Returns null when the request may proceed, or the response to return.
 */
export function requireCronAuth(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    const provided = request.headers.get("authorization") || "";
    return secretsMatch(provided, `Bearer ${secret}`)
      ? null
      : NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "cron_secret_not_configured" },
      { status: 503 },
    );
  }

  return null;
}
