/**
 * Client helper: vertical open APIs return 409 OPEN_LOOP with nextHref.
 * Redirect to finish the ranked case instead of showing a generic error.
 */
export function redirectIfOpenLoop(
  data: { error?: string; nextHref?: unknown },
  push: (href: string) => void,
): boolean {
  if (data.error === "OPEN_LOOP" && typeof data.nextHref === "string" && data.nextHref) {
    push(data.nextHref);
    return true;
  }
  return false;
}

export function hasOutreachEmail(value: string | undefined | null): boolean {
  const v = (value ?? "").trim();
  return v.includes("@") && v.length >= 5;
}
