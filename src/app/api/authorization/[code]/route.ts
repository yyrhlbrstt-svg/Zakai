import { NextResponse } from "next/server";
import { getPublicAuthorization } from "@/lib/services/authorization";

/** Public authorization lookup for the provider-facing verify page. No auth. */
export async function GET(_request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const auth = await getPublicAuthorization(code);
  if (!auth) return NextResponse.json({ found: false }, { status: 404 });
  return NextResponse.json({ found: true, authorization: auth });
}
