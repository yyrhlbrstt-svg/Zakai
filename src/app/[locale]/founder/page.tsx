import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { formatAgorot } from "@/lib/money";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

/**
 * Founder-only metrics — the instrument for the #1 priority: proving the core
 * loop (draft → send → real saving) actually converts, across real cases.
 * Gated by ADMIN_EMAIL (comma-separated allowed). No admin system needed: it
 * reuses the normal session and just checks the email. Not linked anywhere.
 */
function isAdmin(email: string): boolean {
  const allow = (process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}

export default async function FounderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login", locale });
  if (!isAdmin(user!.email)) redirect({ href: "/dashboard", locale });

  const [byStatus, savedAgg, feeAgg, paidAgg, users, checks] = await Promise.all([
    prisma.case.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.savingsProof.aggregate({ _sum: { savingMonthly: true }, _count: { _all: true } }),
    prisma.fee.aggregate({ _sum: { amount: true }, _count: { _all: true } }),
    prisma.fee.aggregate({ where: { status: "PAID" }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.user.count(),
    prisma.case.count(),
  ]);

  const count = (s: string) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
  const sent = count("SENT") + count("SAVED") + count("NO_SAVING");
  const saved = count("SAVED");
  const noSaving = count("NO_SAVING");
  const settled = saved + noSaving;
  // The number that validates the whole model: of outreach that got a reply,
  // what share produced a real, documented saving?
  const winRate = settled > 0 ? Math.round((saved / settled) * 100) : null;

  const money = (a: number) => formatAgorot(a, "he-IL");

  const rows: [string, string][] = [
    ["משתמשים", String(users)],
    ["בדיקות שנפתחו", String(checks)],
    ["נשלחו לספק (SENT+)", String(sent)],
    ["הגיעו לתוצאה (נענו)", String(settled)],
    ["חיסכון תועד (SAVED)", String(saved)],
    ["ללא חיסכון (NO_SAVING)", String(noSaving)],
    ["— אחוז הצלחה (SAVED מהנענים) —", winRate === null ? "אין עדיין נתונים" : `${winRate}%`],
    ["סה״כ חיסכון חודשי מתועד", money(savedAgg._sum.savingMonthly ?? 0)],
    ["הוכחות חיסכון", String(savedAgg._count._all)],
    ["עמלות שנוצרו", `${feeAgg._count._all} · ${money(feeAgg._sum.amount ?? 0)}`],
    ["עמלות ששולמו", `${paidAgg._count._all} · ${money(paidAgg._sum.amount ?? 0)}`],
  ];

  return (
    <main className="max-w-[680px] mx-auto px-5 pb-24 pt-8" dir="rtl">
      <h1 className="font-display text-3xl mb-1.5">מדדי מייסד</h1>
      <p className="text-ink-soft text-[14px] mb-7">
        המספר שמאמת את המודל: <b className="text-emerald">אחוז ההצלחה</b> — מתוך הפניות שנענו, כמה
        הניבו חיסכון אמיתי ומתועד. הרץ 20–30 תיקי סלולר אמיתיים וצפה כאן שהלופ באמת סוגר כסף.
      </p>

      <div className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
        {rows.map(([label, value], i) => {
          const highlight = label.includes("אחוז הצלחה");
          return (
            <div
              key={label}
              className={`flex items-center justify-between gap-4 px-5 py-3.5 ${
                i > 0 ? "border-t border-[rgba(255,255,255,0.07)]" : ""
              } ${highlight ? "bg-[rgba(63,203,155,0.06)]" : ""}`}
            >
              <span className={`text-[14px] ${highlight ? "font-extrabold text-emerald" : "text-ink-soft"}`}>
                {label}
              </span>
              <span
                className={`tabular-nums ${
                  highlight ? "font-display grad-text text-2xl" : "font-extrabold text-[15px]"
                }`}
              >
                {value}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[11.5px] text-[rgba(147,166,165,0.7)] mt-5 leading-relaxed">
        עמוד פנימי, גלוי רק לכתובות ב-ADMIN_EMAIL. אם אחוז ההצלחה נמוך או לא יציב על מדגם אמיתי — זו
        התובנה הכי חשובה של המוצר, לפני כל ורטיקל או שיווק נוסף.
      </p>
    </main>
  );
}
