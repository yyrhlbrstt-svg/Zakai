/**
 * Same bar as release-gate / preflight MAIL — never SMTP_HOST alone.
 * HOST without USER/PASS is not a working transport; treating it as "mail on"
 * greenwashes Outbox QUEUED as delivery.
 */
export function smtpFullyConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim(),
  );
}
