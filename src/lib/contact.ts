/**
 * Where things land when the environment has not been configured yet.
 *
 * WHY THERE IS A REAL ADDRESS HERE AND NOT A PLACEHOLDER
 *
 * The previous fallbacks were on `zakai.example`, a domain reserved by RFC 2606
 * that cannot receive mail. That is fine as a marker and dangerous as a default:
 * a wrong address passes every check, is accepted by the transport, and
 * discards the message silently. Nobody discovers it by testing — they discover
 * it by wondering, weeks later, why the enquiries stopped.
 *
 * So the fallback is a real inbox. Where a notification lands is not a
 * privilege, so nothing is granted by having one, and the consequence of the
 * environment being half-configured becomes "the mail goes to the founder"
 * rather than "the mail goes nowhere".
 *
 * The environment variables still win. This is the floor, not the setting.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *
 * `ADMIN_EMAIL`. That one is a privilege — it opens the founder dashboard,
 * which now lists every lead's contact details — and signup does not verify
 * that somebody controls the address they register with. A hardcoded default
 * would publish exactly which address to register in order to obtain it. It
 * stays environment-only, and the preflight asks for it.
 */

export const FOUNDER_EMAIL = "yyrhlbrstt@gmail.com";

/** RFC 2606 and other placeholder domains must never be shown to users. */
function isPlaceholderMailbox(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return domain.endsWith(".example") || domain === "example.com" || domain === "example.org";
}

/** Privacy, support links, and case footers — env wins; never a dead `.example` inbox. */
export function publicSupportEmail(): string {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  if (raw && !isPlaceholderMailbox(raw)) return raw;
  return FOUNDER_EMAIL;
}

export function publicSecurityEmail(): string {
  const raw = process.env.NEXT_PUBLIC_SECURITY_EMAIL?.trim();
  if (raw && !isPlaceholderMailbox(raw)) return raw;
  return FOUNDER_EMAIL;
}
