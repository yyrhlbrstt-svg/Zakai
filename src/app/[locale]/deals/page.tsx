import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Reveal } from "@/components/Reveal";
import { SpotlightCard } from "@/components/SpotlightCard";

export const metadata: Metadata = {
  title: "הטבות ודילים — זכאי",
  description:
    "אוסף הטבות ומהלכים אמיתיים שחוסכים לך כסף מיד — סלולר, חשמל, בנק, זכויות ועוד. חינמי. קופונים בלעדיים בקרוב.",
};

interface Deal {
  icon: string;
  title: string;
  desc: string;
  action: string;
  href: string;
}

export default async function DealsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("deals");
  const items = t.raw("items") as Deal[];

  return (
    <main className="max-w-[980px] mx-auto px-5 pb-24 pt-6">
      <div className="max-w-[640px]">
        <Reveal>
          <h1 className="font-display text-[clamp(28px,5vw,42px)] leading-[1.14] m-0 text-balance">
            {t("title")}
          </h1>
        </Reveal>
        <Reveal delay={100}>
          <p className="text-ink-soft text-[15.5px] leading-[1.7] my-5">{t("sub")}</p>
        </Reveal>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))] mt-6">
        {items.map((d, i) => (
          <Reveal key={d.title} delay={Math.min(i * 40, 320)}>
            <Link href={d.href} className="no-underline text-ink block h-full">
              <SpotlightCard className="p-5 h-full transition-colors duration-200 hover:border-[rgba(63,203,155,0.4)]">
                <div className="text-[26px]" aria-hidden>{d.icon}</div>
                <div className="font-extrabold text-[15px] mt-2.5">{d.title}</div>
                <div className="text-ink-soft text-[12.5px] mt-1 leading-relaxed">{d.desc}</div>
                <div className="text-emerald text-[12.5px] font-bold mt-2.5">{d.action} ←</div>
              </SpotlightCard>
            </Link>
          </Reveal>
        ))}
      </div>

      {/* Exclusive coupons — the affiliate roadmap, honestly framed. */}
      <Reveal>
        <div className="mt-10 rounded-2xl border border-[rgba(240,180,92,0.3)] bg-[rgba(240,180,92,0.05)] p-6 text-center max-w-[640px] mx-auto">
          <div className="text-[28px]" aria-hidden>🎟️</div>
          <div className="font-extrabold text-[15px] mt-1.5">{t("soon")}</div>
          <div className="text-ink-soft text-[13px] mt-1.5 leading-relaxed">{t("soonSub")}</div>
        </div>
      </Reveal>
    </main>
  );
}
