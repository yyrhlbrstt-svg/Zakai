import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { FAQ, FAQ_CATEGORIES, type FaqCategory } from "@/lib/faq";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { SpotlightCard } from "@/components/SpotlightCard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "faqPage" });
  return { title: t("metaTitle"), description: t("metaDesc") };
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("faqPage");
  const he = locale === "he";

  const q = (e: (typeof FAQ)[number]) => (he ? e.q_he : e.q_en);
  const a = (e: (typeof FAQ)[number]) => (he ? e.a_he : e.a_en);
  const catName = (c: (typeof FAQ_CATEGORIES)[number]) => (he ? c.he : c.en);

  return (
    <VerticalPageShell heroGlow kicker={t("kicker")} title={t("title")} sub={t("sub")}>
      {/* Category jump-links — quick scanning on mobile. */}
      <nav className="flex flex-wrap gap-2 mt-6" aria-label={t("title")}>
        {FAQ_CATEGORIES.map((c) => (
          <a
            key={c.key}
            href={`#${c.key}`}
            className="text-[12.5px] font-bold text-ink-soft border border-[rgba(255,255,255,0.12)] rounded-full px-3 py-1.5 no-underline hover:border-[rgba(63,203,155,0.4)] hover:text-emerald transition-colors"
          >
            {catName(c)}
          </a>
        ))}
      </nav>

      <div className="mt-10 flex flex-col gap-10">
        {FAQ_CATEGORIES.map((c) => {
          const items = FAQ.filter((e) => e.category === (c.key as FaqCategory));
          if (items.length === 0) return null;
          return (
            <section key={c.key} id={c.key} className="scroll-mt-24">
              <h2 className="text-[15px] font-extrabold text-emerald uppercase tracking-wide mb-3.5">
                {catName(c)}
              </h2>
              <div className="flex flex-col gap-2.5">
                {items.map((e) => (
                  <details
                    key={e.id}
                    className="group rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-5 py-4 open:border-[rgba(63,203,155,0.3)] open:bg-[rgba(63,203,155,0.04)] transition-colors"
                  >
                    <summary className="flex items-center justify-between gap-3 cursor-pointer list-none font-extrabold text-[15.5px] marker:content-['']">
                      {q(e)}
                      <span
                        className="text-emerald text-xl leading-none shrink-0 transition-transform group-open:rotate-45"
                        aria-hidden
                      >
                        +
                      </span>
                    </summary>
                    <p className="text-ink-soft text-[14.5px] leading-relaxed mt-3">{a(e)}</p>
                  </details>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <SpotlightCard className="mt-14 px-6 py-7 text-center">
        <div className="font-display text-xl">{t("more.title")}</div>
        <p className="text-ink-soft text-[14px] mt-2 max-w-[460px] mx-auto">{t("more.body")}</p>
        <div className="flex flex-wrap gap-3 justify-center mt-5">
          <Link href="/assistant">
            <Button>{t("more.askBtn")}</Button>
          </Link>
          <Link href="/check">
            <Button variant="ghost">{t("more.checkBtn")}</Button>
          </Link>
        </div>
      </SpotlightCard>
    </VerticalPageShell>
  );
}
