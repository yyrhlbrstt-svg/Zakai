/** CORS for partner-hosted widget scripts calling Zakai APIs from the browser. */
export function widgetCorsHeaders(
  request: Request,
  opts?: { allowOrigin?: string | null },
): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allow =
    opts?.allowOrigin === undefined
      ? "*"
      : opts.allowOrigin && opts.allowOrigin.length > 0
        ? opts.allowOrigin
        : "*";

  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "X-Zakai-Widget-Key, X-Zakai-Widget-Version, Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (allow !== "*" && origin) {
    headers.Vary = "Origin";
  }
  return headers;
}
