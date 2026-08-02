import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ENTITLEMENTS, type RightCategory } from "@/lib/rights";
import { entitlementSlug, IL_ENTITLEMENT_IDS } from "@/lib/rightsSeo";

const CATEGORY_ORDER: RightCategory[] = [
  "consumer",
  "tax",
  "bituach",
  "municipal",
  "banking",
  "health",
  "work",
  "transport",
  "education",
  "army",
  "family",
  "senior",
  "housing",
];

export async function RightsCatalogIndex({
  locale,
  market = "IL",
}: {
  locale: string;
  market?: string;
}) {
  if (market.toUpperCase() !== "IL") {
    const { ZmlCatalogTeaser } = await import("@/components/ZmlCatalogTeaser");
    return <ZmlCatalogTeaser locale={locale} market={market} />;
  }

  const t = await getTranslations({ locale, namespace: "rights" });
  const byCat = new Map<RightCategory, string[]>();

  for (const e of ENTITLEMENTS) {
    if (!IL_ENTITLEMENT_IDS.has(e.id)) continue;
    const arr = byCat.get(e.category) ?? [];
    arr.push(e.id);
    byCat.set(e.category, arr);
  }

  return (
    <section className="mt-14">
      <h2 className="text-[17px] font-extrabold mb-2">
        {locale === "he" || locale === "ar" ? "מדריך זכויות (SEO)" : "Rights guides"}
      </h2>
      <p className="text-ink-soft text-[13px] mb-6 leading-relaxed">
        {locale === "he" || locale === "ar"
          ? "דף נפרד לכל זכות — מקורות רשמיים וקישור לכלי בזכאי."
          : "One page per right — official sources and a path to act in Zakai."}
      </p>
      <div className="flex flex-col gap-6">
        {CATEGORY_ORDER.map((cat) => {
          const ids = byCat.get(cat);
          if (!ids?.length) return null;
          return (
            <div key={cat}>
              <div className="text-[13px] font-extrabold text-emerald mb-2">
                {t(`categories.${cat}`)}
              </div>
              <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
                {ids.map((id) => {
                  const item = t.raw(`items.${id}`) as { title?: string } | undefined;
                  if (!item?.title) return null;
                  return (
                    <li key={id}>
                      <Link
                        href={`/rights/${entitlementSlug(id)}`}
                        className="text-[13.5px] text-ink-soft hover:text-emerald no-underline"
                      >
                        {item.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
