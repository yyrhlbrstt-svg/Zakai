import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui";
import { Zakameter } from "@/components/Zakameter";
import { Reveal } from "@/components/Reveal";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Globe, ScanLine, Ban, Scale, Zap } from "lucide-react";
import { formatAgorot } from "@/lib/money";
import { isIsrael, getCountry } from "@/lib/geo";
import { allMarkets } from "@/lib/global/registry";
import { bcp47, type Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

async function loadProof() {
  try {
    const [agg, count] = await Promise.all([
      prisma.savingsProof.aggregate({ _sum: { savingMonthly: true } }),
      prisma.savingsProof.count({ where: { savingMonthly: { gt: 0 } } }),
    ]);
    return { monthlyAgorot: agg._sum.savingMonthly ?? 0, count };
  } catch {
    return { monthlyAgorot: 0, count: 0 };
  }
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const proof = await loadProof();

  const steps = ["upload", "act", "pay"] as const;
  const trust = t.raw("home.trust") as string[];
  const israeliVisitor = await isIsrael();
  const visitorCountry = await getCountry();
  const markets = allMarkets();

  const countryTag = (() => {
    if (!visitorCountry) return "";
    try {
      const name = new Intl.DisplayNames([locale], { type: "region" }).of(visitorCountry);
      return name ? ` · ${name}` : "";
    } catch {
      return "";
    }
  })();

  const he = locale === "he";
  const ar = locale === "ar";
  const ru = locale === "ru";

  const doors = [
    {
      href: "/money",
      icon: ScanLine,
      title: he
        ? "משלם יותר מדי"
        : ar
          ? "أدفع أكثر من اللازم"
          : ru
            ? "Плачу слишком много"
            : "Paying too much",
      sub: he
        ? "סרוק חיובים · הסוכן פונה · חיסכון מתועד"
        : ar
          ? "امسح الفواتير · الوكيل يتفاوض · توفير موثق"
          : ru
            ? "Сканируй счета · агент пишет · экономия с доказательством"
            : "Scan bills · agent negotiates · documented savings",
      cta: he ? "הכסף שלי →" : ar ? "أموالي →" : ru ? "Мои деньги →" : "My money →",
      accent: "emerald" as const,
    },
    {
      href: "/cancel",
      icon: Ban,
      title: he
        ? "בטל מנוי שלא צריך"
        : ar
          ? "ألغِ اشتراكًا لا تحتاجه"
          : ru
            ? "Отмени ненужную подписку"
            : "Cancel a subscription",
      sub: he
        ? "סוכן שולח · Mandate · מעקב אוטומטי"
        : ar
          ? "الوكيل يرسل · تفويض · متابعة تلقائية"
          : ru
            ? "Агент отправляет · Mandate · авто-follow-up"
            : "Agent sends · Mandate · auto follow-up",
      cta: he ? "ביטול עם סוכן →" : ar ? "إلغاء مع وكيل →" : ru ? "Отмена с агентом →" : "Agent cancel →",
      accent: "violet" as const,
    },
    {
      href: "/what-am-i-owed",
      icon: Scale,
      title: he
        ? "מה מגיע לי?"
        : ar
          ? "ما الذي يستحق لي؟"
          : ru
            ? "Что мне положено?"
            : "What am I owed?",
      sub: he
        ? "זכויות · הטבות · החזרים שלא דרשת"
        : ar
          ? "حقوق · مزايا · استردادات لم تطالب بها"
          : ru
            ? "Права · льготы · возвраты которые не забрали"
            : "Rights · benefits · refunds you never claimed",
      cta: he ? "בדוק זכויות →" : ar ? "تحقق من الحقوق →" : ru ? "Проверить права →" : "Check rights →",
      accent: "sky" as const,
    },
    {
      href: "/electricity",
      icon: Zap,
      title: he
        ? "חשמל יקר מדי"
        : ar
          ? "كهرباء غالية"
          : ru
            ? "Дорогое электричество"
            : "Electricity too high",
      sub: he
        ? "השווה ספקים · הסוכן פונה · ניוד עם Mandate"
        : ar
          ? "قارن الموردين · الوكيل يتواصل · تفويض"
          : ru
            ? "Сравни поставщиков · агент пишет · Mandate"
            : "Compare suppliers · agent acts · Mandate switch",
      cta: he ? "מעבר ספק →" : ar ? "تغيير المورد →" : ru ? "Сменить поставщика →" : "Switch supplier →",
      accent: "amber" as const,
    },
  ];

  const accentClass = {
    emerald: {
      border: "border-[rgba(63,203,155,0.4)]",
      bg: "bg-[rgba(63,203,155,0.08)]",
      text: "text-emerald",
      iconBg: "bg-[rgba(63,203,155,0.2)]",
    },
    violet: {
      border: "border-[rgba(139,92,246,0.4)]",
      bg: "bg-[rgba(139,92,246,0.08)]",
      text: "text-[#c4b5fd]",
      iconBg: "bg-[rgba(139,92,246,0.2)]",
    },
    sky: {
      border: "border-[rgba(62,198,255,0.4)]",
      bg: "bg-[rgba(62,198,255,0.08)]",
      text: "text-[#3ec6ff]",
      iconBg: "bg-[rgba(62,198,255,0.2)]",
    },
    amber: {
      border: "border-[rgba(240,180,92,0.4)]",
      bg: "bg-[rgba(240,180,92,0.08)]",
      text: "text-[#f0b45c]",
      iconBg: "bg-[rgba(240,180,92,0.2)]",
    },
  };

  return (
    <main className="max-w-[1080px] mx-auto px-5 pb-28 pt-6">
      <div className="mb-5 rounded-2xl border border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.12)] px-4 py-3.5 text-[13.5px] font-bold leading-relaxed">
        {he
          ? "הסטנדרט לסוכן כסף צרכני · Money OS · Mandate · בלי מוקד · v1.2"
          : "The standard consumer money agent · Money OS · Mandate · No call center · v1.2"}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
        <Globe size={14} className="text-emerald shrink-0" aria-hidden />
        <span className="font-bold text-ink">{he ? "שווקים:" : "Markets:"}</span>
        {markets.map((m) => (
          <span
            key={m.code}
            className={`rounded-full px-2.5 py-1 border ${
              visitorCountry === m.code
                ? "border-[rgba(63,203,155,0.5)] bg-[rgba(63,203,155,0.12)] text-emerald font-extrabold"
                : "border-[rgba(255,255,255,0.1)]"
            }`}
          >
            {m.code}
          </span>
        ))}
      </div>

      {!israeliVisitor && (
        <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-[rgba(62,198,255,0.28)] bg-[rgba(62,198,255,0.06)] px-5 py-3.5 text-[13.5px] text-ink-soft leading-relaxed">
          <Globe size={18} className="shrink-0 text-[#3ec6ff]" aria-hidden />
          <span>{t("home.geoNote")}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-12 items-center mb-10">
        <div className="flex-1 min-w-[300px] basis-[400px]">
          <Reveal>
            <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-6">
              {t("home.kicker")}
              {countryTag}
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-display text-[clamp(36px,5.4vw,52px)] leading-[1.12] m-0 text-balance">
              {he ? (
                <>
                  כסף ששייך לך
                  <br />
                  <span className="grad-text">ועדיין לא חזר</span>
                </>
              ) : (
                <>
                  {t("home.title1")}
                  <br />
                  <span className="grad-text">{t("home.title2")}</span>
                </>
              )}
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="text-ink-soft text-[17px] leading-[1.75] my-7 max-w-[520px]">
              {he
                ? "זכאי הוא מערכת ההפעלה לכסף של הצרכן: סריקה, Mandate, שליחה, מעקב, חיסכון מתועד. בלי מוקד. בלי להשאיר טלפון. עמלה רק אם נחסך בפועל."
                : "Zakai is the consumer money OS: scan, Mandate, send, follow up, documented saving. No call center. No phone left behind. Fee only when money is actually saved."}
            </p>
          </Reveal>
        </div>

        <Reveal delay={160} className="flex-1 min-w-[320px] basis-[380px]">
          <Zakameter bcp47={bcp47[locale as Locale]} />
        </Reveal>
      </div>

      <Reveal>
        <h2 className="text-[15px] font-extrabold mb-4 text-ink-soft uppercase tracking-wide">
          {he ? "מאיפה מתחילים?" : ar ? "من أين نبدأ؟" : ru ? "С чего начать?" : "Where do you start?"}
        </h2>
      </Reveal>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))] mb-14">
        {doors.map((d, i) => {
          const a = accentClass[d.accent];
          const Icon = d.icon;
          return (
            <Reveal key={d.href} delay={i * 70}>
              <Link href={d.href} className="no-underline block h-full">
                <SpotlightCard
                  className={`p-6 h-full ${a.border} ${a.bg} hover:scale-[1.02] transition-transform`}
                >
                  <div className={`w-11 h-11 rounded-xl ${a.iconBg} flex items-center justify-center mb-4`}>
                    <Icon size={22} className={a.text} aria-hidden />
                  </div>
                  <div className={`font-extrabold text-[17px] ${a.text}`}>{d.title}</div>
                  <div className="text-ink-soft text-[13.5px] mt-2 leading-relaxed">{d.sub}</div>
                  <div className={`mt-4 text-[14px] font-extrabold ${a.text}`}>{d.cta}</div>
                </SpotlightCard>
              </Link>
            </Reveal>
          );
        })}
      </div>

      <Reveal delay={80}>
        <div className="grid grid-cols-3 gap-3 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] px-4 py-5">
          {(t.raw("home.stats") as Array<{ n: string; label: string }>).map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-display grad-text text-[clamp(24px,6vw,34px)] leading-none tabular-nums">
                {s.n}
              </div>
              <div className="text-ink-soft text-[11.5px] mt-1.5 leading-tight">{s.label}</div>
            </div>
          ))}
        </div>
      </Reveal>

      {proof.count > 0 && (
        <Reveal>
          <div className="mt-10 text-center rounded-2xl border border-[rgba(63,203,155,0.3)] bg-[rgba(63,203,155,0.06)] px-6 py-5">
            <span className="font-display grad-text text-3xl">
              {formatAgorot(proof.monthlyAgorot, bcp47[locale as Locale])}
            </span>
            <span className="block text-[13px] text-ink-soft mt-1.5">
              {t("home.proof", { count: proof.count })}
            </span>
          </div>
        </Reveal>
      )}

      <Reveal delay={100}>
        <ul className="flex flex-col gap-2 mt-10 list-none p-0 m-0 max-w-[560px]">
          {trust.map((line) => (
            <li key={line} className="flex items-center gap-2.5 text-[13.5px] text-ink-soft">
              <span className="text-emerald font-black" aria-hidden>
                ✓
              </span>
              {line}
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal>
        <h2 className="text-[17px] font-extrabold mt-16 mb-4">{t("home.howTitle")}</h2>
      </Reveal>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {steps.map((key, i) => (
          <Reveal key={key} delay={i * 90}>
            <SpotlightCard className="p-6 h-full">
              <div className="flex items-center gap-3">
                <div className="w-[30px] h-[30px] rounded-[9px] grad-bg text-[#06121A] flex items-center justify-center font-black text-sm">
                  {i + 1}
                </div>
              </div>
              <div className="font-extrabold text-base mt-3">{t(`onboarding.steps.${key}.title`)}</div>
              <div className="text-ink-soft text-[13.5px] mt-1.5 leading-relaxed">
                {t(`onboarding.steps.${key}.sub`)}
              </div>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <h2 className="text-[17px] font-extrabold mt-16 mb-4">{t("home.whyTitle")}</h2>
      </Reveal>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {(["alone", "services", "zakai"] as const).map((col, i) => (
          <Reveal key={col} delay={i * 90}>
            <SpotlightCard
              className={`p-6 h-full ${col === "zakai" ? "border-[rgba(63,203,155,0.45)]" : ""}`}
            >
              <div className={`font-extrabold text-[15px] ${col === "zakai" ? "text-emerald" : ""`}>
                {t(`home.why.${col}.title`)}
              </div>
              <ul className="mt-3 flex flex-col gap-2 list-none p-0 m-0">
                {(t.raw(`home.why.${col}.points`) as string[]).map((p) => (
                  <li key={p} className="flex gap-2.5 items-start text-[13px] text-ink-soft leading-relaxed">
                    <span
                      className={`font-black shrink-0 ${col === "zakai" ? "text-emerald" : "text-[rgba(147,166,165,0.6)]"}`}
                      aria-hidden
                    >
                      {col === "zakai" ? "✓" : "•"}
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="mt-16 rounded-2xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.07)] px-6 py-8 text-center">
          <div className="font-display text-[clamp(22px,4vw,32px)] leading-tight">
            {he ? "הכול עובר דרך זכאי — מוביל הקטגוריה" : "Everything through Zakai — category leader"}
          </div>
          <p className="text-ink-soft text-[15px] mt-3 max-w-[520px] mx-auto leading-relaxed">
            {he
              ? "מי ששולט בלולאה סריקה→Mandate→חיסכון→שיתוף שולט בשוק. אנחנו בונים את הלולאה הזו בכל שוק — וגם את התשתית שמוסדות יאמצו."
              : "Whoever owns scan→Mandate→saving→share owns the market. We're building that loop in every market — and the infrastructure institutions adopt."}
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-6">
            <Link href="/money">
              <Button className="!text-[15px] !px-6 !py-3">
                {he ? "הכסף שלי" : "My money"}
              </Button>
            </Link>
            <Link href="/business">
              <Button variant="ghost">{he ? "לעסקים ומוסדות" : "Business & institutions"}</Button>
            </Link>
          </div>
        </div>
      </Reveal>

      <p className="mt-10 text-[11.5px] text-[rgba(147,166,165,0.7)] text-center leading-relaxed max-w-[560px] mx-auto">
        {t("home.scopeNote")}
      </p>
    </main>
  );
}
