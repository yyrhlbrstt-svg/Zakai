import type { Metadata } from "next";
import { setRequestLocale , getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { formatAgorot } from "@/lib/money";
import { Button, Card } from "@/components/ui";
import { ShareResult } from "@/components/ShareResult";
import { bcp47, type Locale } from "@/i18n/config";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "inline_app_locale_wrapped_page" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/wrapped") },
  };
}

export default async function WrappedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const he = locale === "he" || locale === "ar";
  const tIapp_locale_wrapped_page = await getTranslations({ locale, namespace: "inline_app_locale_wrapped_page" });
  const loc = bcp47[locale as Locale];
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/login?return=/wrapped", locale });
    return null;
  }

  const year = new Date().getFullYear();
  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);

  const cases = await prisma.case.findMany({
    where: { userId: user.id, createdAt: { gte: yearStart } },
    include: { savingsProof: true, authorization: true },
  });

  const saved = cases.filter((c) => c.status === "SAVED" && c.savingsProof);
  const monthly = saved.reduce((s, c) => s + (c.savingsProof?.savingMonthly ?? 0), 0);
  const yearly = monthly * 12;
  const sent = cases.filter((c) =>
    ["SENT", "SAVED", "NO_SAVING"].includes(c.status),
  ).length;
  const mandates = cases.filter((c) => c.authorization?.status === "ACTIVE").length;

  const referralCode =
    (await prisma.user.findUnique({ where: { id: user.id }, select: { referralCode: true } }))
      ?.referralCode ?? "";

  const shareMsg = he
    ? monthly > 0
      ? `ב-${year} חסכתי ${formatAgorot(monthly, loc)} בחודש עם זכאי — בלי מוקד, בלי להשאיר טלפון.`
      : `התחלתי עם זכאי ב-${year} — סוכן כסף צרכני, בלי מוקד.`
    : monthly > 0
      ? `In ${year} I saved ${formatAgorot(monthly, loc)}/mo with Zakai — no call center.`
      : `Started with Zakai in ${year} — consumer money agent, no call center.`;

  return (
    <main className="max-w-[640px] mx-auto px-5 pb-24 pt-4">
      <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
        Zakai Wrapped · {year}
      </div>
      <h1 className="font-display text-[clamp(28px,5vw,40px)] leading-tight m-0">
        {tIapp_locale_wrapped_page("title")}
      </h1>
      <p className="text-ink-soft text-[15px] mt-3 leading-relaxed">
        {tIapp_locale_wrapped_page("t_b8e0de13")}
      </p>

      <div className="grid grid-cols-2 gap-3 mt-8">
        <Stat
          label={tIapp_locale_wrapped_page("t_8bdc4d33")}
          value={String(cases.length)}
        />
        <Stat
          label={tIapp_locale_wrapped_page("t_2617f830")}
          value={String(sent)}
        />
        <Stat
          label={tIapp_locale_wrapped_page("t_bbc0f36f")}
          value={String(mandates)}
        />
        <Stat
          label={tIapp_locale_wrapped_page("t_c4ab9bbc")}
          value={String(saved.length)}
        />
      </div>

      <Card className="mt-6 p-6 text-center border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.08)]">
        <div className="text-[13px] text-ink-soft font-bold">
          {tIapp_locale_wrapped_page("t_ece7121c")}
        </div>
        <div className="font-display grad-text text-5xl mt-2">
          {formatAgorot(monthly, loc)}
        </div>
        <div className="text-[13px] text-ink-soft mt-2">
          {tIapp_locale_wrapped_page("yearlyLine", { amount: formatAgorot(yearly, loc) })}
        </div>
      </Card>

      <ShareResult message={shareMsg} path="/wrapped" referralCode={referralCode} />

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/money">
          <Button>{tIapp_locale_wrapped_page("t_bd4c0905")}</Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="ghost">{tIapp_locale_wrapped_page("t_143fe31f")}</Button>
        </Link>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4 text-center">
      <div className="font-display text-3xl grad-text">{value}</div>
      <div className="text-[12px] text-ink-soft mt-1">{label}</div>
    </Card>
  );
}
