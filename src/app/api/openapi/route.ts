import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
export const revalidate = 86400;

export async function GET(request: Request) {
  const path = join(process.cwd(), "public/.well-known/zakai-openapi.json");
  const spec = JSON.parse(readFileSync(path, "utf8"));
  const origin = new URL(request.url).origin;
  return NextResponse.json(
    {
      ...spec,
      servers: [{ url: `${origin}/api`, description: "This deployment" }],
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
      },
    },
  );
}
