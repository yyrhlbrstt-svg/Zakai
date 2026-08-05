/**
 * Locale pick without the JSX `{he ? "…" : "…"}` pattern that repeatedly
 * broke the Vercel/SWC build. Prefer next-intl `t()` for new copy; this helper
 * is the safe migration valve for existing inline pairs.
 */
export function heEn(he: boolean, heText: string, enText: string): string {
  return he ? heText : enText;
}
