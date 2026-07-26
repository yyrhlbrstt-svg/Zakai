import { NextResponse } from "next/server";
import { authenticateApiKey, hasPermission, PartnerError } from "@/lib/services/partners";
import { rateLimit } from "@/lib/ratelimit";

export type PartnerRecord = NonNullable<Awaited<ReturnType<typeof authenticateApiKey>>>;

export interface B2BContext {
  partner: PartnerRecord;
}

export async function requireApiKey(request: Request): Promise<
  | { ok: true; partner: PartnerRecord }
  | { ok: false; response: NextResponse }
> {
  const key = request.headers.get("x-api-key");
  if (!key) {
    return { ok: false, response: errorResponse("missingApiKey", 401) };
  }

  const partner = await authenticateApiKey(key);
  if (!partner) {
    return { ok: false, response: errorResponse("invalidApiKey", 401) };
  }

  const limited = await rateLimit("b2b", partner.id, partner.rateLimit, 60);
  if (!limited.ok) {
    return { ok: false, response: errorResponse("rateLimit", 429) };
  }

  return { ok: true, partner };
}

export function requirePermission(
  partner: PartnerRecord,
  permission: string,
): boolean {
  return hasPermission(partner, permission);
}

export function errorResponse(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

export function handlePartnerError(err: unknown): NextResponse {
  if (err instanceof PartnerError) {
    const status = err.message === "NOT_FOUND" ? 404 : 400;
    return errorResponse(err.message, status);
  }
  throw err;
}
