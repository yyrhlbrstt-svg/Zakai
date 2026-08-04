import { NextRequest, NextResponse } from "next/server";
import { parseMarketParam } from "@/lib/global/marketGeo";
import { MARKET_COOKIE, MARKET_COOKIE_MAX_AGE_SEC } from "@/lib/global/marketGeo";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const market = parseMarketParam(url.searchParams.get("market"));
  if (!market) {
    return NextResponse.json({ error: "unknown_market" }, { status: 400 });
  }

  const returnTo = url.searchParams.get("return") || "/en/global";
  const target = returnTo.startsWith("/") ? new URL(returnTo, request.url) : new URL("/en/global", request.url);

  const res = NextResponse.redirect(target);
  res.cookies.set(MARKET_COOKIE, market, {
    maxAge: MARKET_COOKIE_MAX_AGE_SEC,
    sameSite: "lax",
    path: "/",
  });
  return res;
}
