import { cookies, headers } from "next/headers";
import { resolveVisitorMarket } from "@/lib/global/marketGeo";

export async function getVisitorMarket(): Promise<string> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const geo =
    headerStore.get("x-vercel-ip-country") ||
    headerStore.get("cf-ipcountry") ||
    undefined;
  return resolveVisitorMarket(cookieStore.get("zakai_market")?.value, geo);
}
