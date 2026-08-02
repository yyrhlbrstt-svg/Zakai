import type { Locale } from "@/i18n/config";
import { PACK_RIGHT_LABELS } from "./packLabels.generated";

/**
 * Short UI title for a jurisdiction-pack right (Hebrew / English UI).
 * Falls back to null — caller should show statutory `source` from the pack.
 */
export function packRightUILabel(
  marketCode: string,
  rightId: string,
  locale: Locale,
): string | null {
  const row = PACK_RIGHT_LABELS[`${marketCode}:${rightId}`];
  if (!row) return null;
  if (locale === "he" || locale === "ar") return row.he;
  return row.en;
}
