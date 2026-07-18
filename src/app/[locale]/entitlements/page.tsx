import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { EntitlementQuiz } from "@/components/EntitlementQuiz";
import { bcp47, type Locale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "מה מגיע לי? — זכאי",
  description:
    "שאלון קצר שמראה לך אילו זכויות, מענקים והחזרים מגיעים לך בישראל — לפי הפרופיל שלך, בלי להירשם.",
};

/**
 * The entry funnel: a short, guided "what am I entitled to?" quiz. Runs entirely
 * in the browser over the deterministic rights engine — nothing is stored.
 */
export default async function EntitlementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <EntitlementQuiz bcp47={bcp47[locale as Locale]} />;
}
