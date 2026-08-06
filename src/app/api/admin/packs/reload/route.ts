import { NextResponse } from "next/server";
import { handleReloadNotification } from "@/lib/protocol/packs/loader";
import { clearZmlCatalogCache } from "@/lib/protocol/zml/catalog";
import { secretsMatch } from "@/lib/security/timingSafe";

export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const expected = process.env.ZAKAI_ADMIN_TOKEN?.trim();
  if (!expected) return false;
  const auth = request.headers.get("Authorization") || "";
  return secretsMatch(auth, `Bearer ${expected}`);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let commit = "unknown";
  try {
    const body = (await request.json()) as { commit?: string };
    commit = body.commit ?? commit;
  } catch {
    /* empty body ok */
  }

  await handleReloadNotification(commit);
  clearZmlCatalogCache();

  return NextResponse.json({ status: "ok", cache: "invalidated", commit });
}
