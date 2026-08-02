import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CORS = { "Access-Control-Allow-Origin": "*" };

/**
 * Public evaluate hook — full evaluation needs a UniversalProfile (PII-adjacent).
 * Integrators should run predicates client-side or use the in-app rights check.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return NextResponse.json(
    {
      zml_id: decodeURIComponent(id),
      status: "use_in_app",
      message:
        "Server-side evaluation with personal data is not exposed on the public catalog. Use GET /api/rights/catalog/{id}?full=1 for the ZML predicate, or the Zakai rights check in-app.",
      rights_check_path: "/rights",
    },
    { headers: CORS },
  );
}
