"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";

/** Shown when the user has zero cases — /money is the only primary door. */
export function EmptyDashboardActions() {
  const tIcomponents_EmptyDashboardActions = useTranslations(
    "inline_components_EmptyDashboardActions",
  );

  return (
    <div className="mt-8 text-start">
      <div className="rounded-2xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.08)] p-5 mb-6">
        <div className="font-extrabold text-[15px]">
          {tIcomponents_EmptyDashboardActions("t_8e012a21")}
        </div>
        <p className="text-ink-soft text-[13px] mt-1.5 mb-4 leading-relaxed">
          {tIcomponents_EmptyDashboardActions("t_0536a00e")}
        </p>
        <Link href="/money#zakai-money-scan">
          <Button className="!text-[13.5px] !py-2.5 w-full sm:w-auto">
            {tIcomponents_EmptyDashboardActions("t_12298790")}
          </Button>
        </Link>
        <details className="mt-4">
          <summary className="cursor-pointer text-[12.5px] font-bold text-ink-soft list-none [&::-webkit-details-marker]:hidden">
            {tIcomponents_EmptyDashboardActions("t_1e2507e3")} ·{" "}
            {tIcomponents_EmptyDashboardActions("t_0ea869b4")} · …
          </summary>
          <div className="flex flex-wrap gap-2.5 mt-3">
            <Link href="/cancel">
              <Button variant="ghost" className="!text-[13.5px] !py-2.5">
                {tIcomponents_EmptyDashboardActions("t_1e2507e3")}
              </Button>
            </Link>
            <Link href="/electricity">
              <Button variant="ghost" className="!text-[13.5px] !py-2.5">
                {tIcomponents_EmptyDashboardActions("t_0ea869b4")}
              </Button>
            </Link>
            <Link href="/what-am-i-owed">
              <Button variant="ghost" className="!text-[13.5px] !py-2.5">
                {tIcomponents_EmptyDashboardActions("t_cb700000")}
              </Button>
            </Link>
            <Link href="/leaks">
              <Button variant="ghost" className="!text-[13.5px] !py-2.5">
                {tIcomponents_EmptyDashboardActions("t_16c6cdf1")}
              </Button>
            </Link>
          </div>
        </details>
      </div>
    </div>
  );
}
