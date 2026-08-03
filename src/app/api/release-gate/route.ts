import { NextResponse } from "next/server";
import { evaluateConsumerReleaseGate } from "@/lib/deploy/releaseGate";
import { isInternalOpsRequest } from "@/lib/ops/internalAdminGate";

export const dynamic = "force-dynamic";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

/**
 * Public: scores + failing check ids only (no env key names).
 * Internal: full bootstrap hints for founder (?internal=1 + X-Zakai-Admin-Token).
 */
export async function GET(request: Request) {
  const gate = evaluateConsumerReleaseGate();
  const internal = isInternalOpsRequest(request);

  const failingPublic = gate.checks
    .filter((c) => c.level !== "optional" && !c.ok)
    .map((c) => ({ id: c.id, level: c.level }));

  const failingInternal = gate.checks
    .filter((c) => c.level !== "optional" && !c.ok)
    .map((c) => ({ id: c.id, level: c.level, envKeys: c.envKeys, cost: c.cost }));

  return NextResponse.json(
    {
      ok: true,
      releaseScore: gate.releaseScore,
      canReleaseConsumerApp: gate.canReleaseConsumerApp,
      failing: internal ? failingInternal : failingPublic,
      docs: internal
        ? {
            excellence: "docs/EXCELLENCE_SCORECARD.md",
            vercel: "docs/VERCEL_PRODUCTION_CHECKLIST.md",
            bootstrap: "node scripts/bootstrap-release-env.mjs",
            security: "docs/SECURITY_SURFACE.md",
          }
        : {
            howTo: "HOW-TO-SEE.md",
            security: "docs/SECURITY_SURFACE.md",
          },
    },
    { headers: cors },
  );
}
