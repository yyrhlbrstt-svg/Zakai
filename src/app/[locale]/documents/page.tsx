import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { redirect, Link } from "@/i18n/routing";
import { FileText, Shield } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { Card, Button } from "@/components/ui";
import { formatAgorot } from "@/lib/money";
import { providerHebrewName } from "@/lib/providers";
import { bcp47, type Locale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "מסמכים — זכאי",
  description: "ייפויי כוח, Mandate והוכחות חיסכון במקום אחד.",
};

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const he = locale === "he" || locale === "ar";
  const loc = bcp47[locale as Locale];
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login", locale });

  const cases = await prisma.case.findMany({
    where: { userId: user!.id },
    orderBy: { createdAt: "desc" },
    include: { authorization: true, savingsProof: true },
  });

  const withAuth = cases.filter((c) => c.authorization);
  const withProof = cases.filter((c) => c.savingsProof);

  return (
    <main className="max-w-[720px] mx-auto px-5 pb-24 pt-4">
      <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
        {he ? "כספת מסמכים" : "Document vault"}
      </div>
      <h1 className="font-display text-[clamp(28px,5vw,40px)] leading-tight m-0">
        {he ? "מסמכים והרשאות" : "Documents & mandates"}
      </h1>
      <p className="text-ink-soft text-[15px] leading-relaxed mt-3 max-w-[520px]">
        {he
          ? "ייפויי כוח, קודי Mandate והוכחות חיסכון — להדפסה, שיתוף או אימות מול ספק."
          : "Power-of-attorney docs, Mandate codes and savings proofs — print, share or verify with a provider."}
      </p>

      <h2 className="text-[16px] font-extrabold mt-10 mb-3 flex items-center gap-2">
        <Shield size={16} className="text-emerald" aria-hidden />
        {he ? "הרשאות פעילות" : "Active authorizations"}
      </h2>
      {withAuth.length === 0 ? (
        <Card className="p-6 text-center text-ink-soft text-[14px]">
          {he ? "עדיין אין הרשאות. פתח תיק ב-Money OS." : "No authorizations yet. Open a case in Money OS."}
          <div className="mt-3">
            <Link href="/money">
              <Button variant="ghost">{he ? "הכסף שלי" : "My money"}</Button>
            </Link>
          </div>
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
                  {c.authorization!.code} · {c.authorization!.status}
                </div>
              </div>
              <Link href={`/authorization/${c.authorization!.code}`}>
                <Button variant="ghost" className="!text-[13px] !py-2">
                  {he ? "פתח / הדפס" : "Open / print"}
                </Button>
              </Link>
            </div>
          ))}
        </Card>
      )}

      <h2 className="text-[16px] font-extrabold mt-10 mb-3 flex items-center gap-2">
        <FileText size={16} className="text-emerald" aria-hidden />
        {he ? "הוכחות חיסכון" : "Savings proofs"}
      </h2>
      {withProof.length === 0 ? (
        <Card className="p-6 text-center text-ink-soft text-[14px]">
          {he ? "עדיין אין חיסכון מתועד." : "No documented savings yet."}
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
                  {c.savingsProof!.recordedAt.toLocaleDateString(loc)}
                </div>
              </div>
              <div className="font-display text-lg text-emerald">
                −{formatAgorot(c.savingsProof!.savingMonthly, loc)}
                <span className="text-[12px] text-ink-soft font-sans"> {he ? "/ח׳" : "/mo"}</span>
              </div>
            </div>
          ))}
        </Card>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/dashboard">
          <Button variant="ghost">{he ? "לדשבורד" : "Dashboard"}</Button>
        </Link>
        <Link href="/wrapped">
          <Button variant="ghost">{he ? "שנה עם זכאי" : "Year with Zakai"}</Button>
        </Link>
      </div>
    </main>
  );
}
