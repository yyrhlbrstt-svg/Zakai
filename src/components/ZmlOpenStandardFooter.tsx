import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo";
import { buildZmlCatalogForMarket } from "@/lib/protocol/zml/catalog";

export async function ZmlOpenStandardFooter({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "zmlFooter" });
  let ilCount = 0;
  try {
    const rights = await buildZmlCatalogForMarket(SITE_URL, "IL");
    ilCount = rights.length;
  } catch {
    ilCount = 0;
  }

  return (
    <footer className="mt-12 pt-6 border-t border-[rgba(255,255,255,0.08)]">
      <p className="text-[12px] font-extrabold text-emerald m-0 mb-1">{t("label")}</p>
      <p className="text-[12.5px] text-ink-soft m-0 mb-3 leading-relaxed">
        {t("body", { count: ilCount })}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-[12.5px] font-bold">
        <a
          href={`${SITE_URL}/.well-known/zakai-packs.json`}
          className="text-emerald no-underline"
          rel="noopener noreferrer"
        >
          zakai-packs.json
        </a>
        <a
          href={`${SITE_URL}/api/zml/stats`}
          className="text-ink-soft no-underline hover:text-emerald"
          rel="noopener noreferrer"
        >
          /api/zml/stats
        </a>
        <a
          href={`${SITE_URL}/api/rights/catalog?market=IL`}
          className="text-ink-soft no-underline hover:text-emerald"
          rel="noopener noreferrer"
        >
          catalog (IL)
        </a>
        <Link href="/domains" className="text-ink-soft no-underline hover:text-emerald">
          {t("domainsLink")}
        </Link>
      </div>
    </footer>
  );
}
