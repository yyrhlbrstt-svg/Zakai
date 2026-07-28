import { NextResponse } from "next/server";
import { getPublicAuthorization } from "@/lib/services/authorization";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { renderMandateHtml } from "@/lib/mandate/document";

/**
 * Self-contained printable / downloadable Mandate document.
 * Returns HTML with print CSS + Content-Disposition attachment so the user
 * can save and open (or Print → PDF) without leaving the app.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const limited = await rateLimit("authz-pdf", clientIp(request), 30, 3600);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { code } = await ctx.params;
  const auth = await getPublicAuthorization(code);
  if (!auth) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const html = renderMandateHtml({
    code: auth.code,
    principalName: auth.principalName,
    principalContact: auth.principalPhoneMasked,
    provider: auth.provider,
    scope: auth.scope,
    issuedAt: auth.issuedAt,
    status: auth.status,
  });

  const filename = `zakai-mandate-${auth.code}.html`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
