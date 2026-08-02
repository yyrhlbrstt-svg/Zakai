import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
export const revalidate = 86400;

/** Canonical JSON Schema for ZML v1 — community contract, not app internals. */
export async function GET() {
  const path = join(process.cwd(), "src/lib/protocol/zml/zakai-rights-schema.json");
  const body = readFileSync(path, "utf8");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/schema+json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}

export async function HEAD() {
  return GET();
}
