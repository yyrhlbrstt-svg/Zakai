import "server-only";

/** Founder/ops diagnostics — never expose env values in JSON. */
export function isInternalOpsRequest(request: Request): boolean {
  const adminToken = process.env.ZAKAI_ADMIN_TOKEN?.trim();
  if (!adminToken) return false;
  const url = new URL(request.url);
  if (url.searchParams.get("internal") !== "1") return false;
  return request.headers.get("x-zakai-admin-token") === adminToken;
}
