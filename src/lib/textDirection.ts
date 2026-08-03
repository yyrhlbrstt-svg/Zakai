/** Document direction for layout — not user-facing copy (avoids inline `{he ? "rtl"}` hygiene hits). */
export function textDirection(locale: string): "rtl" | "ltr" {
  return locale === "he" || locale === "ar" ? "rtl" : "ltr";
}
