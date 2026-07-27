"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { dueReminders, type CaseReminder } from "@/lib/reminders";

/** Shows local due follow-ups — no server worker, solo-friendly. */
export function ReminderBanner() {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const [due, setDue] = useState<CaseReminder[]>([]);

  useEffect(() => {
    setDue(dueReminders());
  }, []);

  if (due.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[rgba(62,198,255,0.35)] bg-[rgba(62,198,255,0.08)] px-5 py-3.5 mb-5 text-[14px]">
      <div className="font-bold">
        {he
          ? `יש ${due.length} תיקים שממתינים למעקב אחרי הספק`
          : `${due.length} case(s) waiting for a provider follow-up`}
      </div>
      <Link href="/dashboard" className="text-emerald font-bold no-underline text-[13px]">
        {he ? "פתח דשבורד והכן הודעת המשך" : "Open dashboard and draft follow-up"}
      </Link>
    </div>
  );
}
