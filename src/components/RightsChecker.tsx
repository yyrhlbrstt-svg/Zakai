"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { evaluateRights, type RightsProfile, type RightCategory } from "@/lib/rights";
import { formatAgorot } from "@/lib/money";

const AGE_GROUPS = ["18_24", "25_44", "45_66", "67_plus"] as const;
const EMPLOYMENTS = ["employee", "self_employed", "unemployed", "student", "soldier", "retired"] as const;
const FLAGS = ["renting", "lowIncome", "newImmigrant", "dischargedSoldier", "reservist", "disability"] as const;
const CATEGORY_ORDER: RightCategory[] = [
  "consumer", "tax", "bituach", "municipal", "banking", "army", "family", "senior", "housing",
];

/**
 * The Big Rights Check — 8 quick questions, 42-entitlement personalized list.
 * Pure client-side (lib/rights); nothing is sent or stored anywhere.
 */
export function RightsChecker({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("rights");
  const [profile, setProfile] = useState<RightsProfile>({
    ageGroup: "25_44",
    employment: "employee",
    children: 0,
    childrenUnder6: 0,
    renting: false,
    lowIncome: false,
    newImmigrant: false,
    dischargedSoldier: false,
    reservist: false,
    disability: false,
  });

  const result = useMemo(() => evaluateRights(profile), [profile]);
  const money = (a: number) => formatAgorot(a, bcp47);

  const chip = (active: boolean) =>
    `rounded-full px-3.5 py-2 text-[13px] font-bold cursor-pointer border transition-colors duration-200 ${
      active
        ? "bg-[rgba(63,203,155,0.14)] border-[rgba(63,203,155,0.5)] text-emerald"
        : "bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-ink-soft hover:border-[rgba(255,255,255,0.2)]"
    }`;

  const counter = (label: string, value: number, set: (n: number) => void, max: number) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-ink-soft">{label}</span>
      <div className="flex items-center gap-2.5" dir="ltr">
        <button type="button" aria-label="-" onClick={() => set(Math.max(0, value - 1))}
          className="w-8 h-8 rounded-[10px] bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.12)] text-ink font-black cursor-pointer">−</button>
        <span className="font-display text-lg min-w-[22px] text-center">{value}</span>
        <button type="button" aria-label="+" onClick={() => set(Math.min(max, value + 1))}
          className="w-8 h-8 rounded-[10px] bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.12)] text-ink font-black cursor-pointer">+</button>
      </div>
    </div>
  );

  return (
    <div>
      <Card className="p-6 flex flex-col gap-5">
        <div>
          <span className="text-[13px] text-ink-soft block mb-2">{t("q.age")}</span>
          <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={t("q.age")}>
            {AGE_GROUPS.map((a) => (
              <button key={a} type="button" role="radio" aria-checked={profile.ageGroup === a}
                onClick={() => setProfile({ ...profile, ageGroup: a })} className={chip(profile.ageGroup === a)}>
                {t(`q.ages.${a}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[13px] text-ink-soft block mb-2">{t("q.employment")}</span>
          <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={t("q.employment")}>
            {EMPLOYMENTS.map((e) => (
              <button key={e} type="button" role="radio" aria-checked={profile.employment === e}
                onClick={() => setProfile({ ...profile, employment: e })} className={chip(profile.employment === e)}>
                {t(`q.employments.${e}`)}
              </button>
            ))}
          </div>
        </div>

        {counter(t("q.children"), profile.children, (n) =>
          setProfile({ ...profile, children: n, childrenUnder6: Math.min(profile.childrenUnder6, n) }), 8)}
        {profile.children > 0 &&
          counter(t("q.childrenUnder6"), profile.childrenUnder6, (n) =>
            setProfile({ ...profile, childrenUnder6: n }), profile.children)}

        <div>
          <span className="text-[13px] text-ink-soft block mb-2">{t("q.flags")}</span>
          <div className="flex gap-2 flex-wrap">
            {FLAGS.map((f) => (
              <button key={f} type="button" aria-pressed={profile[f]}
                onClick={() => setProfile({ ...profile, [f]: !profile[f] })} className={chip(profile[f])}>
                {t(`q.${f}`)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="mt-5 p-6 text-center">
        <div className="font-display grad-text text-3xl" aria-live="polite">
          {t("resultsTitle", { count: result.matches.length })}
        </div>
        {result.quantifiedYearlyAgorot > 0 && (
          <p className="text-ink-soft text-[13px] mt-2 mb-0 leading-relaxed">
            {t("quantified", { amount: money(result.quantifiedYearlyAgorot) })}
          </p>
        )}
      </Card>

      {CATEGORY_ORDER.filter((c) => result.byCategory.has(c)).map((cat) => (
        <div key={cat} className="mt-6">
          <h2 className="text-[15px] font-extrabold mb-3">{t(`categories.${cat}`)}</h2>
          <Card className="py-1">
            {result.byCategory.get(cat)!.map((e, i, arr) => (
              <details key={e.id} className="px-5 py-3.5"
                style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                <summary className="cursor-pointer flex items-center gap-3 flex-wrap list-none">
                  <span className="font-extrabold text-[14.5px] flex-1 basis-[200px]">
                    {t(`items.${e.id}.title`)}
                  </span>
                  <span className="text-[11.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-2.5 py-1">
                    {e.yearlyAgorot
                      ? t("valueYearly", { amount: money(e.yearlyAgorot) })
                      : e.oneTimeAgorot
                        ? t("valueOneTime")
                        : t("valueVaries")}
                  </span>
                </summary>
                <p className="text-ink-soft text-[13px] mt-2 mb-1 leading-relaxed">
                  {t(`items.${e.id}.desc`)}
                </p>
                <p className="text-[12.5px] m-0 leading-relaxed">
                  <span className="text-emerald font-bold">{t("howTo")}</span>{" "}
                  {t(`items.${e.id}.how`)}
                </p>
              </details>
            ))}
          </Card>
        </div>
      ))}

      <p className="mt-6 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}
