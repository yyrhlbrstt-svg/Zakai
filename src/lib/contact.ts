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

/**
 * The support address ONLY when a real one is configured — null when the
 * founder-inbox fallback would apply. Screens use this to decide whether to
 * PRINT an address: a personal gmail on a public page reads as a hobby
 * project, so unconfigured surfaces show a labeled contact path instead,
 * while mailto/delivery keeps using publicSupportEmail() underneath —
 * hiding the text must never mean discarding the enquiry.
 */
export function configuredSupportEmail(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  if (raw && !isPlaceholderMailbox(raw)) return raw;
  return null;
}

/** Same rule for the security contact. */
export function configuredSecurityEmail(): string | null {
  const raw = process.env.NEXT_PUBLIC_SECURITY_EMAIL?.trim();
  if (raw && !isPlaceholderMailbox(raw)) return raw;
  return null;
}

export function publicSecurityEmail(): string {
  const raw = process.env.NEXT_PUBLIC_SECURITY_EMAIL?.trim();
  if (raw && !isPlaceholderMailbox(raw)) return raw;
  return FOUNDER_EMAIL;
}

function inboundMailbox(...keys: Array<string | undefined>): string {
  for (const key of keys) {
    const raw = key?.trim();
    if (raw && !isPlaceholderMailbox(raw)) return raw;
  }
  return publicSupportEmail();
}

/** Consumer leads — never a dead `.example` inbox when env is half-configured. */
export function leadsInboundEmail(): string {
  return inboundMailbox(process.env.LEADS_EMAIL, process.env.NEXT_PUBLIC_SUPPORT_EMAIL);
}

export function salesInboundEmail(): string {
  return inboundMailbox(process.env.SALES_EMAIL, process.env.NEXT_PUBLIC_SUPPORT_EMAIL);
}

export function feedbackInboundEmail(): string {
  return inboundMailbox(process.env.FEEDBACK_EMAIL, process.env.NEXT_PUBLIC_SUPPORT_EMAIL);
}
