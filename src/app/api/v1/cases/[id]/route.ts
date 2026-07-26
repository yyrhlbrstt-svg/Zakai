import { NextResponse } from "next/server";
import { requireApiKey, handlePartnerError } from "@/lib/b2b-api";
import { partnerCaseStatus } from "@/lib/services/partners";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  try {
    const result = await partnerCaseStatus(auth.partner.id, id);
    return NextResponse.json(result);
  } catch (err) {
    return handlePartnerError(err);
  }
}
