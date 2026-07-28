import type { Metadata } from "next";
import { setRequestLocale , getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button, Card } from "@/components/ui";
import { SpotlightCard } from "@/components/SpotlightCard";
import { EmbedPreview } from "@/components/EmbedPreview";

export const metadata: Metadata = {
  title: "Zakai Partners — B2B embed & Money OS",
  description:
    "Drop-in embed for banks, fintech and employers. Customer money agent with Mandate — no call center, fee only on documented savings. Multi-path: money, cancel, rights.",
};

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
<script src="https://zakai-3uxj.vercel.app/embed.js" async></script>`;

  const paths = [
    { path: "money", heLabel: "הכסף שלי / סריקה", enLabel: "My money / scan" },
    { path: "cancel", heLabel: "ביטול מנוי עם סוכן", enLabel: "Cancel sub with agent" },
    { path: "what-am-i-owed", heLabel: "מה מגיע לי", enLabel: "What am I owed" },
    { path: "leaks", heLabel: "מפת נזילות", enLabel: "Leaks map" },
  ];

  return (
    <main className="max-w-[720px] mx-auto px-5 pb-24 pt-4">
      <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
        B2B · Partners · multi-path
      </div>
      <h1 className="font-display text-[clamp(28px,5vw,40px)] leading-tight m-0">
        {tIapp_locale_partners_page("t_b2d930bc")}
      </h1>
      <p className="text-ink-soft text-[15.5px] leading-relaxed mt-4 max-w-[560px]">
        {tIapp_locale_partners_page("t_ed2796c2")}
      </p>

      <h2 className="text-[16px] font-extrabold mt-10 mb-3">
        {tIapp_locale_partners_page("t_51ab2ede")}
      </h2>
      <Card className="p-5">
        <pre className="m-0 whitespace-pre-wrap text-[12.5px] leading-relaxed font-mono text-ink-soft overflow-x-auto">
          {snippet}
        </pre>
      </Card>

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
            money · cancel · what-am-i-owed · leaks
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
    </main>
  );
}
