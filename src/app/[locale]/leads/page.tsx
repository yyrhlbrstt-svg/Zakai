import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

/**
 * Founder-only lead inbox — the operational other half of the commissionable
 * lead machine. Every /start submission lands here so the founder can call the
 * lead, connect them to a vetted professional, and close the success fee.
 * Gated by ADMIN_EMAIL (same as /founder); not linked anywhere public.
 */
function isAdmin(email: string): boolean {
  const allow = (process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}

export default async function LeadsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login", locale });
  if (!isAdmin(user!.email)) redirect({ href: "/dashboard", locale });

  const [leads, byVertical] = await Promise.all([
    prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.lead.groupBy({ by: ["vertical"], _count: { _all: true } }),
  ]);

  const topVerticals = [...byVertical]
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 8);

  return (
    <main className="max-w-[900px] mx-auto px-5 pb-24 pt-8" dir="rtl">
      <h1 className="font-display text-3xl mb-1.5">לידים</h1>
      <p className="text-ink-soft text-[14px] mb-6">
        כל פנייה מטופס "בדוק כמה מגיע לך". התקשר, חבר למקצוען, סגור עמלה. סה״כ:{" "}
        <b className="text-emerald">{leads.length}</b>
      </p>

      {topVerticals.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {topVerticals.map((v) => (
            <span
              key={v.vertical}
              className="text-[12.5px] font-bold text-ink-soft border border-[rgba(255,255,255,0.12)] rounded-full px-3 py-1.5"
            >
              {v.vertical} · <b className="text-ink">{v._count._all}</b>
            </span>
          ))}
        </div>
      )}

      {leads.length === 0 ? (
        <p className="text-ink-soft text-[14px]">אין עדיין לידים.</p>
      ) : (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] overflow-x-auto">
          <table className="w-full text-[13px] min-w-[640px]">
            <thead>
              <tr className="text-ink-soft text-[11.5px] uppercase tracking-wide">
                <th className="text-start px-4 py-3 font-bold">תאריך</th>
                <th className="text-start px-3 py-3 font-bold">ורטיקל</th>
                <th className="text-start px-3 py-3 font-bold">שם</th>
                <th className="text-start px-3 py-3 font-bold">טלפון</th>
                <th className="text-start px-3 py-3 font-bold">הערה</th>
                <th className="text-start px-3 py-3 font-bold">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-t border-[rgba(255,255,255,0.07)] align-top">
                  <td className="px-4 py-3 text-ink-soft whitespace-nowrap tabular-nums">
                    {l.createdAt.toLocaleDateString("he-IL")}
                  </td>
                  <td className="px-3 py-3 font-extrabold whitespace-nowrap">{l.vertical}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{l.name}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <a href={`tel:${l.phone}`} className="text-emerald no-underline font-bold">
                      {l.phone}
                    </a>
                  </td>
                  <td className="px-3 py-3 text-ink-soft max-w-[220px]">{l.note || "—"}</td>
                  <td className="px-3 py-3 text-ink-soft whitespace-nowrap">{l.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11.5px] text-[rgba(147,166,165,0.7)] mt-5 leading-relaxed">
        עמוד פנימי, גלוי רק לכתובות ב-ADMIN_EMAIL. הלידים הם משתמשים שהשאירו פרטים מרצונם לבדיקת זכאות —
        טפל בהם מהר, בזמן שהעניין חם.
      </p>
    </main>
  );
}
