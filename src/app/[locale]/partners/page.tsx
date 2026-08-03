import type { Metadata } from "next";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { setRequestLocale , getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button, Card } from "@/components/ui";
import { SpotlightCard } from "@/components/SpotlightCard";
import { EmbedPreview } from "@/components/EmbedPreview";
import { alternateLanguages, SITE_URL } from "@/lib/seo";
import { EMBED_PARTNER_PATH_KEYS } from "@/lib/embedPartnerPaths";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "inline_app_locale_partners_page" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/partners") },
  };
}

export default async function PartnersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const he = locale === "he" || locale === "ar";
  const tIapp_locale_partners_page = await getTranslations({ locale, namespace: "inline_app_locale_partners_page" });

  const snippet = `<div id="zakai-embed"
     data-locale="${locale}"
     data-ref="your-partner-id"
     data-path="money"></div>
<script src="${SITE_URL}/embed.js" async></script>`;

  const widgetSnippet = `<div id="zakai-fairness"
     data-api-key="pk_live_YOUR_KEY"
     data-provider="YourProvider"
     data-market="IL"></div>
<script src="${SITE_URL}/widget/zakai-widget.js"
        data-api-base="${SITE_URL}/api"
        async></script>`;

  const pathLabels: Record<string, { heLabel: string; enLabel: string }> = {
    money: { heLabel: "הכסף שלי / סריקה", enLabel: "My money / scan" },
    cancel: { heLabel: "ביטול מנוי עם סוכן", enLabel: "Cancel sub with agent" },
    check: { heLabel: "סלולר / אינטרנט", enLabel: "Mobile / internet" },
    "bank-fees": { heLabel: "עמלות בנק", enLabel: "Bank fees" },
    electricity: { heLabel: "חשמל", enLabel: "Electricity" },
    leaks: { heLabel: "מפת נזילות", enLabel: "Leaks map" },
    "refund-chase": { heLabel: "החזר כספי", enLabel: "Refund chase" },
    flights: { heLabel: "פיצוי טיסה", enLabel: "Flights" },
    deposit: { heLabel: "פיקדון שכירות", enLabel: "Rental deposit" },
    "duplicate-insurance": { heLabel: "ביטוח כפול", enLabel: "Duplicate insurance" },
    arnona: { heLabel: "ארנונה", enLabel: "Arnona" },
    warranty: { heLabel: "אחריות מוצר", enLabel: "Product warranty" },
    parking: { heLabel: "דוח חניה", enLabel: "Parking appeal" },
    "what-am-i-owed": { heLabel: "מה מגיע לי", enLabel: "What am I owed" },
    start: { heLabel: "תאר את הבעיה", enLabel: "Describe your problem" },
  };
  const paths = EMBED_PARTNER_PATH_KEYS.map((path) => ({
    path,
    heLabel: pathLabels[path]?.heLabel ?? path,
    enLabel: pathLabels[path]?.enLabel ?? path,
  }));

  return (
    <VerticalPageShell
      heroGlow
      className="max-w-[720px] mx-auto px-5 pb-24 pt-4 relative"
      kicker="B2B · Partners · multi-path"
      title={tIapp_locale_partners_page("t_b2d930bc")}
      sub={tIapp_locale_partners_page("t_ed2796c2")}
    >
      <h2 className="text-[16px] font-extrabold mt-10 mb-3">
        {tIapp_locale_partners_page("t_51ab2ede")}
      </h2>
      <Card className="p-5">
        <pre className="m-0 whitespace-pre-wrap text-[12.5px] leading-relaxed font-mono text-ink-soft overflow-x-auto">
          {snippet}
        </pre>
      </Card>

      <h2 className="text-[16px] font-extrabold mt-10 mb-2">
        {tIapp_locale_partners_page("widgetTitle")}
      </h2>
      <p className="text-ink-soft text-[13px] mb-3 m-0 leading-relaxed">
        {tIapp_locale_partners_page("widgetSub")}
      </p>
      <Card className="p-5">
        <pre className="m-0 whitespace-pre-wrap text-[12.5px] leading-relaxed font-mono text-ink-soft overflow-x-auto">
          {widgetSnippet}
        </pre>
      </Card>
      <p className="text-[12px] text-ink-soft mt-3 mb-0">
        <code className="text-emerald">{tIapp_locale_partners_page("widgetValidate")}</code>
      </p>
      <p className="text-[12.5px] mt-3">
        <a
          href="https://github.com/yyrhlbrstt-svg/Zakai/blob/main/docs/WIDGET_EMBED.md"
          className="text-emerald font-bold"
          target="_blank"
          rel="noopener noreferrer"
        >
          {tIapp_locale_partners_page("widgetDocs")} →
        </a>
      </p>

      <div className="mt-6 rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] px-5 py-5">
        <div className="font-extrabold text-[15px]">{tIapp_locale_partners_page("widgetFairnessTitle")}</div>
        <p className="text-[13px] text-ink-soft mt-2 mb-4 leading-relaxed m-0">
          {tIapp_locale_partners_page("widgetFairnessBody")}
        </p>
        <Link href="/business">
          <Button variant="ghost">{tIapp_locale_partners_page("widgetFairnessCta")}</Button>
        </Link>
      </div>

      <div className="grid gap-3 mt-6 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        <SpotlightCard className="p-4">
          <div className="font-extrabold text-[14px]">data-locale</div>
          <div className="text-ink-soft text-[12.5px] mt-1">he · en · ar · ru</div>
        </SpotlightCard>
        <SpotlightCard className="p-4">
          <div className="font-extrabold text-[14px]">data-ref</div>
          <div className="text-ink-soft text-[12.5px] mt-1">
            {tIapp_locale_partners_page("t_e1e4ad0c")}
          </div>
        </SpotlightCard>
        <SpotlightCard className="p-4">
          <div className="font-extrabold text-[14px]">data-path</div>
          <div className="text-ink-soft text-[12.5px] mt-1">
            {EMBED_PARTNER_PATH_KEYS.slice(0, 6).join(" · ")} …
          </div>
        </SpotlightCard>
        <SpotlightCard className="p-4">
          <div className="font-extrabold text-[14px]">data-label / data-sub</div>
          <div className="text-ink-soft text-[12.5px] mt-1">
            {tIapp_locale_partners_page("t_dd12c4d2")}
          </div>
        </SpotlightCard>
      </div>

      <h2 className="text-[16px] font-extrabold mt-10 mb-3">
        {tIapp_locale_partners_page("t_ae1f9601")}
      </h2>
      <div className="grid gap-2.5">
        {paths.map((p) => (
          <div
            key={p.path}
            className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
          >
            <code className="text-[13px] font-mono text-emerald">data-path="{p.path}"</code>
            <span className="text-[13.5px] text-ink-soft">{he ? p.heLabel : p.enLabel}</span>
          </div>
        ))}
      </div>

      <h2 className="text-[16px] font-extrabold mt-10 mb-3">
        {tIapp_locale_partners_page("t_d41d01a3")}
      </h2>
      <EmbedPreview locale={locale} path="money" />

      <div className="mt-10 rounded-2xl border border-[rgba(63,203,155,0.3)] bg-[rgba(63,203,155,0.07)] px-5 py-5">
        <div className="font-extrabold text-[15px]">
          {tIapp_locale_partners_page("t_1f5a49ae")}
        </div>
        <ul className="mt-3 mb-0 ps-5 text-[13.5px] text-ink-soft leading-relaxed flex flex-col gap-1.5">
          <li>{tIapp_locale_partners_page("t_e5df0f96")}</li>
          <li>{tIapp_locale_partners_page("t_3038f823")}</li>
          <li>{tIapp_locale_partners_page("t_20fd415b")}</li>
          <li>{tIapp_locale_partners_page("t_8d5c967a")}</li>
          <li>{tIapp_locale_partners_page("t_464c34f3")}</li>
        </ul>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/business">
          <Button>{tIapp_locale_partners_page("t_82b1161c")}</Button>
        </Link>
        <Link href="/institutions">
          <Button variant="ghost">{tIapp_locale_partners_page("t_784db4db")}</Button>
        </Link>
        <Link href="/money">
          <Button variant="ghost">Money OS</Button>
        </Link>
      </div>
    </VerticalPageShell>
  );
}
