"use client";

import { useEffect, useState } from "react";
import { useLocale , useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { dueFollowUps, dueRechecks, type CaseReminder } from "@/lib/reminders";

/** Local due follow-ups + promo rechecks — no server worker, solo-friendly. */
export function ReminderBanner() {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const tIcomponents_ReminderBanner = useTranslations("inline_components_ReminderBanner");
  const [follow, setFollow] = useState<CaseReminder[]>([]);
  const [recheck, setRecheck] = useState<CaseReminder[]>([]);

  useEffect(() => {
    setFollow(dueFollowUps());
    setRecheck(dueRechecks());
  }, []);

  if (follow.length === 0 && recheck.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 mb-5">
      {follow.length > 0 && (
        <div className="rounded-2xl border border-[rgba(62,198,255,0.35)] bg-[rgba(62,198,255,0.08)] px-5 py-3.5 text-[14px]">
          <div className="font-bold">
            {he
              ? `יש ${follow.length} תיקים שממתינים למעקב אחרי הספק`
              : `${follow.length} case(s) waiting for a provider follow-up`}
          </div>
          <Link href="/money" className="text-emerald font-bold no-underline text-[13px]">
            {tIcomponents_ReminderBanner("t_1a1a5c0a")}
          </Link>
        </div>
      )}
      {recheck.length > 0 && (
        <div className="rounded-2xl border border-[rgba(240,180,92,0.4)] bg-[rgba(240,180,92,0.08)] px-5 py-3.5 text-[14px]">
          <div className="font-bold">
            {he
              ? `עברו ~6 חודשים — שווה לבדוק אם המחיר חזר למעלה (${recheck.length})`
              : `~6 months later — check if the price crept back (${recheck.length})`}
          </div>
          <Link href="/money" className="text-emerald font-bold no-underline text-[13px]">
            {tIcomponents_ReminderBanner("t_86e4f4c1")}
          </Link>
        </div>
      )}
    </div>
  );
}
