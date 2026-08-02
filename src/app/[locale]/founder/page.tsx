import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { isEmailVerified } from "@/lib/services/emailVerification";
import { emailConfigured } from "@/lib/messaging";
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
  // Matching the address is not the same as controlling it. Signup accepts any
  // address, so without this an attacker who registered the ADMIN_EMAIL value
  // first would hold a dashboard listing every lead's name, phone and company.
  // The environment names who may be admin; this proves they are that person.
  if (!(await isEmailVerified(user!.id))) redirect({ href: "/dashboard", locale });

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    byStatus,
    savedAgg,
    feeAgg,
    paidAgg,
    users,
    checks,
    recovery,
    newUsers7d,
    leadsByVertical,
    feedbackCount,
    leads,
    feedbackRows,
    partnerSignups,
  ] = await Promise.all([
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
    // Every /start submission, in full — this used to be split across this
    // page (a 25-row preview) and a separate, unlinked /leads page (a full
    // table). One inbox, not two half-built ones.
    prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 300 }),
    // What people actually typed into "what would you improve in Zakai?" —
    // api/feedback's own comment promises this is stored "so the team can
    // read and prioritise from real user input." Nothing ever rendered it;
    // /founder showed only a count. This is that promise, finally kept.
    prisma.feedback.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    // Signups per B2B embed partner — the only way to answer "did this
    // partner send us anyone" now that middleware.ts actually captures the
    // ref. Excludes null so an empty partnerRef group doesn't show as "0"
    // pretending to be a partner.
    prisma.user.groupBy({
      by: ["partnerRef"],
      where: { partnerRef: { not: null } },
      _count: { _all: true },
    }),
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

  const topVerticals = [...leadsByVertical].sort((a, b) => b._count._all - a._count._all).slice(0, 8);

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

      {!emailConfigured() && (
        <div className="rounded-2xl border border-[rgba(240,138,107,0.4)] bg-[rgba(240,138,107,0.08)] px-5 py-4 mb-6 text-[13.5px] font-bold leading-relaxed">
          ⚠ SMTP_HOST לא מוגדר בסביבה הזו. "נשלחו לספק (SENT+)" למטה סופר תיקים שסומנו SENT
          באפליקציה — לא מיילים שבאמת יצאו. עד שיוגדר SMTP אמיתי, שום פנייה לא הגיעה בפועל לאף ספק,
          ואחוז ההצלחה למטה לא אומר כלום על העולם האמיתי. הרץ <code>node scripts/preflight.mjs</code>{" "}
          לפני שמריצים תיק אמיתי.
        </div>
      )}

      <div className="rounded-2xl border border-[rgba(62,198,255,0.35)] bg-[rgba(62,198,255,0.06)] px-5 py-4 mb-6 text-[13px] leading-relaxed">
        <div className="font-extrabold text-[#3EC6FF] mb-2">שכבות רשת (בלי סודות)</div>
        <p className="m-0 mb-2 text-ink-soft">
          <code>/api/network/readiness</code> · <code>/api/network/opportunity-map</code> ·{" "}
          <a className="text-emerald underline" href="/he/integrations">
            /integrations
          </a>
        </p>
        <p className="m-0 text-ink-soft">
          תבנית outreach לבנק: <code>docs/BANK_OUTREACH.md</code> בריפו.
        </p>
      </div>

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

      {/* B2B embed partner performance — see middleware.ts capturePartnerRef.
          Before this section existed, there was no way to answer "did this
          partner's embed actually send us anyone" — the whole channel was
          marketing with zero measurement behind it. */}
      <h2 className="font-display text-xl mt-10 mb-1.5">ביצועי שותפים (embed)</h2>
      <p className="text-ink-soft text-[13px] mb-4 leading-relaxed">
        הרשמות שהגיעו דרך widget מוטמע (utm_source=embed) — לפי ref של השותף.
      </p>
      {partnerSignups.length === 0 ? (
        <p className="text-ink-soft text-[13.5px]">
          עדיין אין הרשמות משותף. ה-widget לא מטמיע את עצמו — צריך שותף שיטמיע אותו בפועל.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          {[...partnerSignups]
            .sort((a, b) => b._count._all - a._count._all)
            .map((p) => (
              <span
                key={p.partnerRef}
                className="text-[12.5px] font-bold text-ink-soft border border-[rgba(255,255,255,0.12)] rounded-full px-3 py-1.5"
              >
                {p.partnerRef} · <b className="text-ink">{p._count._all}</b>
              </span>
            ))}
        </div>
      )}

      {/* Who to call back. Institutional enquiries first: a bank asking for a
          pilot is not one lead among many, and burying it under consumer volume
          is how the one that matters gets answered a fortnight late. This used
          to be a 25-row preview here, duplicated by a separate, unlinked
          /leads page carrying the full 300-row table — one inbox now, not two
          half-built ones; /leads redirects here. */}
      <h2 className="font-display text-xl mt-10 mb-1.5">פניות — למי לחזור</h2>
      <p className="text-ink-soft text-[13px] mb-4 leading-relaxed">
        כל פנייה נשמרת כאן לפני שנשלח מייל. אם אין SMTP או שהכתובת שגויה — המייל לא יוצא, והרשומה
        הזאת עדיין קיימת. זה המקור, המייל הוא רק התראה. סה״כ: <b className="text-emerald">{totalLeads}</b>
      </p>
      {topVerticals.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {topVerticals.map((v) => (
            <span
              key={v.vertical}
              className="text-[12px] font-bold text-ink-soft border border-[rgba(255,255,255,0.12)] rounded-full px-3 py-1.5"
            >
              {v.vertical} · <b className="text-ink">{v._count._all}</b>
            </span>
          ))}
        </div>
      )}
      {leads.length === 0 ? (
        <p className="text-ink-soft text-[13.5px]">אין עדיין פניות.</p>
      ) : (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
          {[...leads]
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

      {/* User feedback — api/feedback's own comment has promised since it was
          written that submissions are stored "so the team can read and
          prioritise from real user input." Nothing ever rendered them; this
          page showed only a count. A parent typing "קשה" into the feedback
          widget produced a row nobody could read without querying the DB
          directly — exactly the "tin can" gap this section closes. */}
      <h2 className="font-display text-xl mt-10 mb-1.5">משוב ממשתמשים</h2>
      <p className="text-ink-soft text-[13px] mb-4 leading-relaxed">
        כל מה שנכתב בתיבת "מה היית משפר בזכאי" — מהאתר, בלי צורך בחשבון. סה״כ:{" "}
        <b className="text-emerald">{feedbackCount}</b>
      </p>
      {feedbackRows.length === 0 ? (
        <p className="text-ink-soft text-[13.5px]">אין עדיין משוב.</p>
      ) : (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
          {feedbackRows.map((f, i) => (
            <div
              key={f.id}
              className={`px-5 py-3.5 ${i > 0 ? "border-t border-[rgba(255,255,255,0.07)]" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <span className="text-[11.5px] text-ink-soft">
                  {f.context || "—"} · {f.createdAt.toISOString().slice(0, 10)}
                </span>
                {f.email && (
                  <a href={`mailto:${f.email}`} className="text-[11.5px] text-emerald font-bold" dir="ltr">
                    {f.email}
                  </a>
                )}
              </div>
              <p className="text-[13.5px] mt-1.5 mb-0 whitespace-pre-wrap leading-relaxed">{f.message}</p>
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
