import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { redirect, Link } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { Card, Button } from "@/components/ui";
import { ShareResult } from "@/components/ShareResult";
import { formatAgorot } from "@/lib/money";
import { bcp47, type Locale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "שנה עם זכאי",
  description: "כמה חסכת, כמה תיקים, כמה פעמים הסוכן פעל.",
};

export default async function WrappedPage({
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

  const year = new Date().getFullYear();
  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);

  const cases = await prisma.case.findMany({
    where: { userId: user!.id, createdAt: { gte: yearStart } },
    include: { savingsProof: true },
  });

  const savedCases = cases.filter((c) => c.savingsProof && c.savingsProof.savingMonthly > 0);
  const monthlySaved = savedCases.reduce((s, c) => s + (c.savingsProof?.savingMonthly ?? 0), 0);
  const yearlySaved = monthlySaved * 12;
  const sentCount = cases.filter((c) =>
    ["SENT", "SAVED", "NO_SAVING"].includes(c.status),
  ).length;

  const referralCode =
    (await prisma.user.findUnique({ where: { id: user!.id }, select: { referralCode: true } }))
      ?.referralCode ?? "";

  const shareMsg =
    monthlySaved > 0
      ? he
        ? `ב-${year} חסכתי ${formatAgorot(monthlySaved, loc)} לחודש עם זכאי — בלי מוקד.`
        : `In ${year} I saved ${formatAgorot(monthlySaved, loc)}/mo with Zakai — no call center.`
      : he
        ? `אני בודק זכויות עם זכאי — סוכן כסף בלי מוקד.`
        : `I’m checking rights with Zakai — money agent, no call center.`;

  return (
    <main className="max-w-[640px] mx-auto px-5 pb-24 pt-4">
      <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
        {he ? `שנה עם זכאי · ${year}` : `Year with Zakai · ${year}`}
      </div>
      <h1 className="font-display text-[clamp(28px,5vw,42px)] leading-tight m-0">
        {he ? "הסיכום שלך" : "Your year"}
      </h1>
      <p className="text-ink-soft text-[15px] mt-3 leading-relaxed">
        {he
          ? "מספרים אמיתיים מתיקים שסגרת בזכאי. שתף — זה הצמיחה שלנו."
          : "Real numbers from cases you closed in Zakai. Share — that’s our growth engine."}
      </p>

      <div className="mt-8 grid gap-3 grid-cols-2">
        <Card className="p-5 text-center">
          <div className="text-[12px] text-ink-soft font-bold">{he ? "תיקים" : "Cases"}</div>
          <div className="font-display grad-text text-4xl mt-1">{cases.length}</div>
        </Card>
        <Card className="p-5 text-center">
          <div className="text-[12px] text-ink-soft font-bold">{he ? "נשלחו לספק" : "Sent"}</div>
          <div className="font-display grad-text text-4xl mt-1">{sentCount}</div>
        </Card>
        <Card className="p-5 text-center col-span-2">
          <div className="text-[12px] text-ink-soft font-bold">
            {he ? "חיסכון מתועד לחודש" : "Documented monthly saving"}
          </div>
          <div className="font-display grad-text text-5xl mt-1">
            {formatAgorot(monthlySaved, loc)}
          </div>
          {yearlySaved > 0 && (
            <div className="text-[13px] text-ink-soft mt-2">
              {he ? "≈" : "≈"} {formatAgorot(yearlySaved, loc)} {he ? "בשנה" : "/ year"}
            </div>
          )}
        </Card>
        <Card className="p-5 text-center col-span-2">
          <div className="text-[12px] text-ink-soft font-bold">
            {he ? "חיסכונות שתועדו" : "Documented wins"}
          </div>
          <div className="font-display text-3xl mt-1 text-emerald">{savedCases.length}</div>
        </Card>
      </div>

      {cases.length === 0 && (
        <Card className="p-8 text-center mt-6">
          <div className="font-display text-xl">
            {he ? "עדיין אין נתונים לשנה הזו" : "No data for this year yet"}
          </div>
          <p className="text-ink-soft text-[14px] mt-2">
            {he ? "פתח תיק ב-Money OS והסוכן יתחיל לספור." : "Open a case in Money OS and the agent starts counting."}
          </p>
          <Link href="/money" className="inline-block mt-4">
            <Button>{he ? "הכסף שלי" : "My money"}</Button>
          </Link>
        </Card>
      )}

      <ShareResult message={shareMsg} referralCode={referralCode} path="/wrapped" />

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/dashboard">
          <Button variant="ghost">{he ? "לדשבורד" : "Dashboard"}</Button>
        </Link>
        <Link href="/documents">
          <Button variant="ghost">{he ? "מסמכים" : "Documents"}</Button>
        </Link>
      </div>
    </main>
  );
}
