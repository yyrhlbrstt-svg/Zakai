/**
 * Pure disposition for the browser GET after a hosted PSP page.
 * Real money confirmation stays on signed POST webhooks — GET never marks PAID.
 */
export type BrowserFeeDisposition = "paid" | "error" | "confirming";

export function browserFeeReturnWhenUnverified(opts: {
  feeStatus?: string | null;
  outcomeHint?: string | null;
}): BrowserFeeDisposition {
  if (opts.feeStatus === "PAID") return "paid";
  const outcome = (opts.outcomeHint || "").toLowerCase();
  if (outcome === "success" || outcome === "ok") return "confirming";
  return "error";
}

/** Append query params to a return URL that may already carry ?loc=&feeId=. */
export function withReturnQuery(
  returnUrl: string,
  params: Record<string, string>,
): string {
  const url = new URL(returnUrl);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}
