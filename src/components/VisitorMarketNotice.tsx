import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { marketLabel } from "@/lib/global/marketGeo";

export async function VisitorMarketNotice({
  locale,
  market,
}: {
  locale: string;
  market: string;
}) {
  const t = await getTranslations({ locale, namespace: "global" });
  const label = marketLabel(market);

  return (
    <p className="text-body text-ink-soft mb-5 leading-relaxed flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>
        {t("currentMarket", { label, code: market })}
      </span>
      <Link href="/global" className="text-emerald font-bold no-underline hover:underline">
        {t("changeMarket")}
      </Link>
    </p>
  );
}
