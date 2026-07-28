"use client";

import { useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { PriorityActions } from "@/components/PriorityActions";

/** Shown when the user has zero cases — problem doors first, then ranked actions. */
export function EmptyDashboardActions() {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";

  return (
    <div className="mt-8 text-start">
      <div className="rounded-2xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.08)] p-5 mb-6">
        <div className="font-extrabold text-[15px]">
          {he ? "מה הבעיה עכשיו?" : "What's the problem right now?"}
        </div>
        <p className="text-ink-soft text-[13px] mt-1.5 mb-4 leading-relaxed">
          {he
            ? "בחר דלת — הסוכן פותח תיק עם Mandate. בלי מוקד, בלי להשאיר טלפון."
            : "Pick a door — the agent opens a Mandate case. No call center, no phone left behind."}
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/money">
            <Button className="!text-[13.5px] !py-2.5">
              {he ? "משלם יותר מדי →" : "Paying too much →"}
            </Button>
          </Link>
          <Link href="/cancel">
            <Button variant="ghost" className="!text-[13.5px] !py-2.5">
              {he ? "בטל מנוי" : "Cancel a sub"}
            </Button>
          </Link>
          <Link href="/what-am-i-owed">
            <Button variant="ghost" className="!text-[13.5px] !py-2.5">
              {he ? "מה מגיע לי?" : "What am I owed?"}
            </Button>
          </Link>
          <Link href="/leaks">
            <Button variant="ghost" className="!text-[13.5px] !py-2.5">
              {he ? "מפת נזילות" : "Leaks map"}
            </Button>
          </Link>
        </div>
      </div>

      <div className="text-[12.5px] font-extrabold text-ink-soft mb-3 uppercase tracking-wide">
        {he ? "עדיפויות מומלצות" : "Suggested next"}
      </div>
      <PriorityActions limit={4} />
    </div>
  );
}
