import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Card, Button } from "@/components/ui";
import { IconCompass } from "@/components/Icon";

/**
 * Without this, an unmatched route (a typo'd URL, a deleted page, a stale
 * bookmark) fell through to Next.js's own default 404 — unbranded, always
 * English, and looking exactly like the app is broken rather than like the
 * page just isn't there. For a product going into app stores as an
 * installed, standalone experience, that generic page is the worst possible
 * moment to show it: there's no browser chrome around it to signal "this is
 * just a website having a bad day."
 */
export default async function NotFound() {
  const t = await getTranslations("notFoundPage");

  return (
    <main className="max-w-[520px] mx-auto px-5 pt-24 pb-20 text-center">
      <IconCompass width={44} height={44} className="mb-4 mx-auto text-[#3ec6ff]" />
      <Card className="p-8">
        <h1 className="font-display text-2xl mb-2">{t("title")}</h1>
        <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6">{t("subtitle")}</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/">
            <Button>{t("home")}</Button>
          </Link>
          <Link href="/money">
            <Button variant="ghost">{t("money")}</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
