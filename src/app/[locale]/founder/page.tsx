import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { formatAgorot } from "@/lib/money";
import { computeRecoveryGraph } from "@/lib/recoveryGraph";
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

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [byStatus, savedAgg, feeAgg, paidAgg, users, checks, recovery, newUsers7d, leadsByVertical, feedbackCount] =
    await Promise.all([
      prisma.case.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.savingsProof.aggregate({ _sum: { savingMonthly: true }, _count: { _all: true } }),
      prisma.fee.aggregate({ _sum: { amount: true }, _count: { _all: true } }),
      prisma.fee.aggregate({ where: { status: "PAID" }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.user.count(),
      prisma.case.count(),
      computeRecoveryGraph(),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.lead.groupBy({ by: ["vertical"], _count: { _all: true } }),
      prisma.feedback.count(),
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

  // Growth + pipeline signals — the scoreboard for "get users, prove it works".
  // The counts answer "how many". They do not answer "who do I call back",
  // which is the only question that matters on the day one arrives. Mail is a
  // notification and can be missing, misaddressed or unread; this is the record.
  const recentLeads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      vertical: true,
      name: true,
      phone: true,
      email: true,
      company: true,
      note: true,
      status: true,
      createdAt: true,
    },
  });

  const totalLeads = leadsByVertical.reduce((s, r) => s + r._count._all, 0);
  const topLead = [...leadsByVertical].sort((a, b) => b._count._all - a._count._all)[0];
  const leadsValue =
    totalLeads === 0
      ? "אין עדיין"
      : `${totalLeads}${topLead ? ` · מוביל: ${topLead.vertical} (${topLead._count._all})` : ""}`;

  const rows: [string, string][] = [
    ["משתמשים", String(users)],
    ["— משתמשים חדשים (7 ימים) —", String(newUsers7d)],
    ["בדיקות שנפתחו", String(checks)],
    ["לידים לעמלה (ביטוח/וורטיקלים)", leadsValue],
    ["משובים שהתקבלו", String(feedbackCount)],
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

      {/* Who to call back. Institutional enquiries first: a bank asking for a
          pilot is not one lead among many, and burying it under consumer volume
          is how the one that matters gets answered a fortnight late. */}
      <h2 className="font-display text-xl mt-10 mb-1.5">פניות — למי לחזור</h2>
      <p className="text-ink-soft text-[13px] mb-4 leading-relaxed">
        כל פנייה נשמרת כאן לפני שנשלח מייל. אם אין SMTP או שהכתובת שגויה — המייל לא יוצא, והרשומה
        הזאת עדיין קיימת. זה המקור, המייל הוא רק התראה.
      </p>
      {recentLeads.length === 0 ? (
        <p className="text-ink-soft text-[13.5px]">אין עדיין פניות.</p>
      ) : (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
          {[...recentLeads]
            .sort((a, b) => {
              const ai = a.vertical.startsWith("business:") ? 0 : 1;
              const bi = b.vertical.startsWith("business:") ? 0 : 1;
              return ai - bi || b.createdAt.getTime() - a.createdAt.getTime();
            })
            .map((lead, i) => (
              <div
                key={lead.id}
                className={`px-5 py-3.5 ${i > 0 ? "border-t border-[rgba(255,255,255,0.07)]" : ""} ${
                  lead.vertical.startsWith("business:") ? "bg-[rgba(63,203,155,0.06)]" : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="font-extrabold text-[14.5px]">
                    {lead.company || lead.name}
                  </span>
                  <span className="text-[11.5px] text-ink-soft">
                    {lead.vertical} · {lead.createdAt.toISOString().slice(0, 10)} · {lead.status}
                  </span>
                </div>
                <div className="text-[13px] text-ink-soft mt-1" dir="ltr">
                  {[lead.company ? lead.name : null, lead.email, lead.phone]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {lead.note && (
                  <p className="text-[12.5px] text-ink-soft mt-1.5 mb-0 whitespace-pre-wrap leading-relaxed">
                    {lead.note}
                  </p>
                )}
              </div>
            ))}
        </div>
      )}

      {/* The recovery graph — the moat. Per counterparty: what actually works. */}
      <h2 className="font-display text-xl mt-10 mb-1.5">גרף ההשבה — מה עובד מול מי</h2>
      <p className="text-ink-soft text-[13px] mb-4 leading-relaxed">
        החפיר האמיתי (אפקט רשת של דאטה): לכל ספק — אחוז הצלחה, חיסכון ממוצע וזמן ממוצע לתוצאה. ככל
        שנצבור תיקים, זה הופך ל"מה מנצח מול מי" שאף מתחרה לא יכול להעתיק.
      </p>
      {recovery.length === 0 ? (
        <p className="text-ink-soft text-[13.5px]">אין עדיין תיקים לנתח.</p>
      ) : (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] overflow-x-auto">
          <table className="w-full text-[13px] min-w-[440px]">
            <thead>
              <tr className="text-ink-soft text-[11.5px] uppercase tracking-wide">
                <th className="text-start px-4 py-3 font-bold">ספק</th>
                <th className="text-center px-3 py-3 font-bold">נענו</th>
                <th className="text-center px-3 py-3 font-bold">אחוז הצלחה</th>
                <th className="text-center px-3 py-3 font-bold">חיסכון ממוצע</th>
                <th className="text-center px-3 py-3 font-bold">ימים לתוצאה</th>
              </tr>
            </thead>
            <tbody>
              {recovery.map((r) => (
                <tr key={r.provider} className="border-t border-[rgba(255,255,255,0.07)]">
                  <td className="px-4 py-3 font-extrabold">{r.provider}</td>
                  <td className="text-center px-3 py-3 tabular-nums text-ink-soft">{r.settled}</td>
                  <td className="text-center px-3 py-3 tabular-nums font-extrabold text-emerald">
                    {r.winRate === null ? "—" : `${r.winRate}%`}
                  </td>
                  <td className="text-center px-3 py-3 tabular-nums">
                    {r.avgSavingAgorot > 0 ? money(r.avgSavingAgorot) : "—"}
                  </td>
                  <td className="text-center px-3 py-3 tabular-nums text-ink-soft">
                    {r.avgDaysToResolve === null ? "—" : r.avgDaysToResolve}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11.5px] text-[rgba(147,166,165,0.7)] mt-5 leading-relaxed">
        עמוד פנימי, גלוי רק לכתובות ב-ADMIN_EMAIL. אם אחוז ההצלחה נמוך או לא יציב על מדגם אמיתי — זו
        התובנה הכי חשובה של המוצר, לפני כל ורטיקל או שיווק נוסף.
      </p>
    </main>
  );
}
