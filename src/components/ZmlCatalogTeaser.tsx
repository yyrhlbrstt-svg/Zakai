import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { buildCatalogResponse } from "@/lib/protocol/zml/catalog";
import { marketLabel } from "@/lib/global/marketGeo";
import { SITE_URL } from "@/lib/seo";

export async function ZmlCatalogTeaser({
  locale,
  market,
}: {
  locale: string;
  market: string;
}) {
  const t = await getTranslations({ locale, namespace: "global" });
  const catalog = await buildCatalogResponse(SITE_URL, market, { limit: 12, locale });
  if (!catalog?.rights.length) return null;

  const label = marketLabel(market);

  return (
    <section className="mt-14">
      <h2 className="text-[17px] font-extrabold mb-2">
        {t("catalogTeaserTitle", { label })}
      </h2>
      <p className="text-ink-soft text-body mb-4 leading-relaxed">
        {t("catalogTeaserSub", { total: catalog.total })}
      </p>
      <ul className="m-0 p-0 list-none flex flex-col gap-2 mb-4">
        {catalog.rights.map((r) => {
          const name = r.label ??
            r.display_name[locale as keyof typeof r.display_name] ??
            r.display_name.he ??
            r.display_name.en ??
            r.id;
          return (
          <li key={r.id} className="text-[13.5px] text-ink-soft">
            <span className="text-ink font-semibold">{name}</span>
            <span className="text-[11px] ms-2 text-ink-soft">{r.category}</span>
          </li>
          );
        })}
      </ul>
      <a
        href={`${SITE_URL}/api/rights/catalog?market=${market}`}
        className="text-body font-bold text-emerald no-underline hover:underline"
        rel="noopener noreferrer"
      >
        {t("catalogApiLink")}
      </a>
      <span className="text-ink-soft mx-2">·</span>
      <Link href="/global" className="text-body font-bold text-ink-soft no-underline hover:text-emerald">
        {t("changeMarket")}
      </Link>
    </section>
  );
}
