import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Reveal } from "@/components/Reveal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "lostMoney" });
  return { title: t("metaTitle"), description: t("metaDesc") };
}

interface Source {
  icon: string;
  title: string;
  body: string;
  cta: string;
  url: string;
}

export default async function LostMoneyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("lostMoney");
  const sources = t.raw("sources") as Source[];
  const steps = t.raw("steps") as string[];

  return (
    <main className="max-w-[820px] mx-auto px-5 pb-24 pt-5">
      <Reveal>
        <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
          {t("kicker")}
        </div>
        <h1 className="font-display text-[clamp(28px,5vw,44px)] leading-[1.12] m-0 text-balance">
          {t("title")}
        </h1>
        <p className="text-ink-soft text-[16px] leading-relaxed mt-4 max-w-[640px]">{t("sub")}</p>
      </Reveal>

      {/* The official, free government search tools — we guide, we don't gate. */}
      <div className="mt-9 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        {sources.map((s, i) => (
          <Reveal key={s.title} delay={i * 80}>
            <SpotlightCard className="p-6 h-full flex flex-col">
              <div className="text-[26px]" aria-hidden>
                {s.icon}
              </div>
              <div className="font-extrabold text-[16px] mt-3">{s.title}</div>
              <div className="text-ink-soft text-[13.5px] mt-1.5 leading-relaxed flex-1">{s.body}</div>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1.5 text-emerald font-bold text-[13.5px] mt-4 no-underline"
              >
                {s.cta} <span aria-hidden>↗</span>
              </a>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>

      {/* How to actually claim it — a plain checklist. */}
      <Reveal>
        <h2 className="font-display text-2xl mt-14 mb-4">{t("howTitle")}</h2>
      </Reveal>
      <ol className="flex flex-col gap-3 list-none p-0 m-0">
        {steps.map((s, i) => (
          <Reveal key={s} delay={i * 60}>
            <li className="flex gap-3.5 items-start rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-5 py-4">
              <span className="w-[26px] h-[26px] shrink-0 rounded-full grad-bg text-[#06121A] flex items-center justify-center font-black text-[13px]">
                {i + 1}
              </span>
              <span className="text-[14.5px] leading-relaxed">{s}</span>
            </li>
          </Reveal>
        ))}
      </ol>

      <Reveal>
        <div className="mt-12 rounded-2xl p-[1px] bg-[linear-gradient(105deg,#3fcb9b,#3ec6ff_55%,#8b5cf6)]">
          <div className="rounded-2xl bg-[#0a1119] px-6 py-7 text-center">
            <div className="font-display text-xl">{t("cta.title")}</div>
            <p className="text-ink-soft text-[14px] mt-2 max-w-[520px] mx-auto leading-relaxed">
              {t("cta.body")}
            </p>
            <div className="flex flex-wrap gap-3 justify-center mt-5">
              <Link href="/entitlements">
                <Button>{t("cta.primary")}</Button>
              </Link>
              <Link href="/check">
                <Button variant="ghost">{t("cta.secondary")}</Button>
              </Link>
            </div>
          </div>
        </div>
      </Reveal>

      <p className="mt-8 text-[11.5px] text-[rgba(147,166,165,0.7)] text-center leading-relaxed max-w-[600px] mx-auto">
        {t("disclaimer")}
      </p>
    </main>
  );
}
