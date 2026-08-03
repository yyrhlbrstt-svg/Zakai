/** Build a mailto: URL. Body/subject are URI-encoded; `to` must already be a bare address. */
export function buildMailtoHref(to: string, subject: string, body: string): string {
  const addr = to.trim();
  if (!addr || !/@/.test(addr)) return "";
  return `mailto:${addr}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Open the user's mail client with a composed cancel / claim letter. */
export function openMailto(to: string, subject: string, body: string): boolean {
  const href = buildMailtoHref(to, subject, body);
  if (!href || typeof window === "undefined") return false;
  window.location.href = href;
  return true;
}
