"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Card } from "@/components/ui";
import { traceDormant } from "@/lib/dormant/trace";
import type { RightsProfile } from "@/lib/rights";

/**
 * The five categories, converged onto one profile.
 *
 * THE PROBLEM THIS FIXES, WHICH WE CREATED
 *
 * Five money engines were built — entitlements, overcharges, captive pricing,
 * incident claims, dormant accounts — and each arrived with its own screen.
 * That is broader, not better, and "broader but fragmented" is precisely the
 * complaint the profile was introduced to answer. A person who has to visit
 * five tools to find out what they are owed has been handed the same work in a
 * nicer wrapper.
 *
 * So the categories that can be evaluated from the stored profile are evaluated
 * here, together, with no further questions. Two of them can be: dormant money
 * needs one number the profile now holds, and the incident engine needs an
 * event that no profile can ever contain.
 *
 * WHY THE INCIDENT DOOR IS A LINK AND NOT AN INLINE RESULT
 *
 * Everything else here is derived; an injury is not. There is no honest way to
 * infer that something happened to somebody, and guessing would be grotesque.
 * So it is a door that states plainly what is behind it, opened only by a
 * person who knows the answer.
 */
export function MoneyCategories({ profile }: { profile: RightsProfile }) {
  const t = useTranslations("categories");

  const dormant = useMemo(
    () =>
      traceDormant({
        pastEmployers: profile.pastEmployers,
        heldSecurities: profile.holdsSecurities,
      }),
    [profile.pastEmployers, profile.holdsSecurities],
  );

  return (
    <div className="mt-6">
      <h2 className="text-[15px] font-extrabold mb-3">{t("title")}</h2>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
        {/* Derived from the profile already on screen. A count, never a sum —
            a dormant account is nine shekels or ninety thousand. */}
        {dormant.institutionCount > 0 && (
          <Link href="/dormant" className="no-underline">
            <Card className="p-5 h-full hover:border-[rgba(63,203,155,0.4)] transition-colors">
              <div className="font-display text-3xl" dir="ltr">
                {dormant.institutionCount}
              </div>
              <p className="font-extrabold text-[14px] m-0 mt-1 mb-1">{t("dormant.title")}</p>
              <p className="text-ink-soft text-[12.5px] m-0 leading-relaxed">
                {t("dormant.sub")}
              </p>
            </Card>
          </Link>
        )}

        <Link href="/incident" className="no-underline">
          <Card className="p-5 h-full hover:border-[rgba(63,203,155,0.4)] transition-colors">
            <p className="font-extrabold text-[14px] m-0 mb-1">{t("incident.title")}</p>
            <p className="text-ink-soft text-[12.5px] m-0 leading-relaxed">{t("incident.sub")}</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
