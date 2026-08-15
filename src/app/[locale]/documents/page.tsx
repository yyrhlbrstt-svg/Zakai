import type { Metadata } from "next";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { setRequestLocale , getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { Card, Button } from "@/components/ui";
import { formatAgorot } from "@/lib/money";
import { providerHebrewName } from "@/lib/providers";
import { bcp47, type Locale } from "@/i18n/config";
import { alternateLanguages } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "inline_app_locale_documents_page" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/documents") },
  };
}

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tIapp_locale_documents_page = await getTranslations({ locale, namespace: "inline_app_locale_documents_page" });
  const loc = bcp47[locale as Locale];
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/login?return=/documents", locale });
    return null;
  }

  const cases = await prisma.case.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { authorization: true, savingsProof: true },
    take: 50,
  });

  const withAuth = cases.filter((c) => c.authorization);
  const withProof = cases.filter((c) => c.savingsProof);

  return (
    <VerticalPageShell
      heroGlow
      className="max-w-[720px] mx-auto px-5 pb-24 pt-4 relative"
      kicker={tIapp_locale_documents_page("t_be65da89")}
      title={tIapp_locale_documents_page("t_f2bac17f")}
      sub={tIapp_locale_documents_page("t_2f52f216")}
    >
      <h2 className="text-[16px] font-extrabold mt-10 mb-3">
        {tIapp_locale_documents_page("mandatesHeading", { count: withAuth.length })}
      </h2>
      {withAuth.length === 0 ? (
        <Card className="p-5 text-ink-soft text-[14px]">
          {tIapp_locale_documents_page("t_ed1487bf")}
        </Card>
      ) : (
        <Card className="py-1.5">
          {withAuth.map((c, i) => (
            <div
              key={c.id}
              className="flex items-center gap-3 px-5 py-3.5 flex-wrap"
              style={{
                borderBottom: i < withAuth.length - 1 ? "1px solid rgba(255,255,255,0.09)" : "none",
              }}
            >
              <div className="flex-1 min-w-[140px]">
                <div className="font-extrabold text-[15px]">
                  {providerHebrewName(c.provider) !== "הספק" ? providerHebrewName(c.provider) : c.provider}
                </div>
                <div className="text-[12px] text-ink-soft mt-0.5">
                  {c.authorization!.code} · {c.authorization!.status} ·{" "}
                  {c.authorization!.issuedAt.toLocaleDateString(loc)}
                </div>
              </div>
              <Link href={`/authorization/${c.authorization!.code}`}>
                <Button variant="ghost" className="!text-body !py-2">
                  {tIapp_locale_documents_page("t_4e482ddb")}
                </Button>
              </Link>
            </div>
          ))}
        </Card>
      )}

      <h2 className="text-[16px] font-extrabold mt-10 mb-3">
        {tIapp_locale_documents_page("savingsHeading", { count: withProof.length })}
      </h2>
      {withProof.length === 0 ? (
        <Card className="p-5 text-ink-soft text-[14px]">
          {tIapp_locale_documents_page("t_7ef4c59b")}
        </Card>
      ) : (
        <Card className="py-1.5">
          {withProof.map((c, i) => (
            <div
              key={c.id}
              className="flex items-center gap-3 px-5 py-3.5 flex-wrap"
              style={{
                borderBottom: i < withProof.length - 1 ? "1px solid rgba(255,255,255,0.09)" : "none",
              }}
            >
              <div className="flex-1 min-w-[140px]">
                <div className="font-extrabold text-[15px]">
                  {providerHebrewName(c.provider) !== "הספק" ? providerHebrewName(c.provider) : c.provider}
                </div>
                <div className="text-[12px] text-ink-soft mt-0.5">
                  {c.savingsProof!.recordedAt.toLocaleDateString(loc)} · source:{" "}
                  {c.savingsProof!.source}
                </div>
              </div>
              <div className="font-display text-emerald text-lg">
                −{formatAgorot(c.savingsProof!.savingMonthly, loc)}
                <span className="text-[12px] text-ink-soft font-sans"> /{tIapp_locale_documents_page("t_147726d1")}</span>
              </div>
            </div>
          ))}
        </Card>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/money">
          <Button>{tIapp_locale_documents_page("t_bd4c0905")}</Button>
        </Link>
        <Link href="/wrapped">
          <Button variant="ghost">{tIapp_locale_documents_page("t_d3297759")}</Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="ghost">{tIapp_locale_documents_page("t_143fe31f")}</Button>
        </Link>
      </div>
    </VerticalPageShell>
  );
}
