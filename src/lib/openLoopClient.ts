/**
 * Client helper: vertical open APIs return 409 OPEN_LOOP with nextHref.
 * Redirect to finish the ranked case instead of showing a generic error.
 *
 * Shared by ~20 vertical tool components (CheckFlow, ParkingAppeal,
 * ArnonaAgent, BankFeesTool, ...) — all of them called push(nextHref)
 * silently, with nothing telling the person why the screen they were just
 * filling in got replaced by /money. The `openLoop=1` marker lets the
 * landing page show one honest line ("an open case needed attention first")
 * instead of a jump nobody explained — fixed once here for every caller
 * rather than 20 separate edits.
 */
export function redirectIfOpenLoop(
  data: { error?: string; nextHref?: unknown },
  push: (href: string) => void,
): boolean {
  if (data.error === "OPEN_LOOP" && typeof data.nextHref === "string" && data.nextHref) {
    const sep = data.nextHref.includes("?") ? "&" : "?";
    push(`${data.nextHref}${sep}openLoop=1`);
    return true;
  }
  return false;
}

export function hasOutreachEmail(value: string | undefined | null): boolean {
  const v = (value ?? "").trim();
  return v.includes("@") && v.length >= 5;
}
