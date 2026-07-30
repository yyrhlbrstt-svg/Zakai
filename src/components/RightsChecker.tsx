"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, RadioChips } from "@/components/ui";
import { ClaimDocument } from "@/components/ClaimDocument";
import {
  evaluateRights,
  rightsSourceName,
  RIGHTS_COUNTRIES,
  type RightsProfile,
  type RightCategory,
} from "@/lib/rights";
import type { CountryCode } from "@/lib/verticals/types";
import { formatAgorot } from "@/lib/money";
import { MARKETS, fromLegacyIsraeliProfile } from "@/lib/global/registry";
import { GlobalPackRights } from "@/components/GlobalPackRights";

/**
 * Legacy country codes ("UK") to the global-pack market they correspond to
 * ("GB", the actual ISO 3166-1 alpha-2 code MARKETS is keyed by). Only the
 * seven markets with a real `JurisdictionPack` — carrying an actual letter
 * template, not just a checklist entry — appear here. The other six
 * `RIGHTS_COUNTRIES` have no pack yet, and showing nothing beyond the
 * existing checklist for them is the honest choice, not a bug to route
 * around.
 */
const GLOBAL_MARKET_CODE: Partial<Record<CountryCode, string>> = {
  UK: "GB",
  US: "US",
  DE: "DE",
  FR: "FR",
  CA: "CA",
  AU: "AU",
};

const AGE_GROUPS = ["18_24", "25_44", "45_66", "67_plus"] as const;
const EMPLOYMENTS = ["employee", "self_employed", "unemployed", "student", "soldier", "retired"] as const;
const FLAGS = ["renting", "lowIncome", "newImmigrant", "dischargedSoldier", "reservist", "disability"] as const;
const CATEGORY_ORDER: RightCategory[] = [
  "consumer", "benefits", "tax", "work", "bituach", "health", "municipal", "banking",
  "transport", "education", "army", "family", "senior", "housing",
];

/**
 * The Big Rights Check — 8 quick questions, 42-entitlement personalized list.
 * Pure client-side (lib/rights); nothing is sent or stored anywhere.
 */
export function RightsChecker({ bcp47, defaultCountry = "IL" }: { bcp47: string; defaultCountry?: CountryCode }) {
  const t = useTranslations("rights");
  const [country, setCountry] = useState<CountryCode>(defaultCountry);
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

  const result = useMemo(() => evaluateRights(profile, country), [profile, country]);
  const money = (a: number) => formatAgorot(a, bcp47);

  // The six markets with a real JurisdictionPack — a letter template, not
  // just a checklist entry. IL deliberately excluded: it already renders
  // through the legacy path above, and the pack is proven (by
  // src/lib/global/engine.test.ts) to return the identical set of rights, so
  // showing it a second time here would just be the same list twice.
  const globalMarketCode = GLOBAL_MARKET_CODE[country];
  const globalMarket = globalMarketCode ? MARKETS[globalMarketCode] : undefined;
  const universalProfile = useMemo(() => fromLegacyIsraeliProfile(profile), [profile]);

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
          <span className="text-[13px] text-ink-soft block mb-2">{t("country")}</span>
          <RadioChips
            value={country}
            onChange={setCountry}
            ariaLabel={t("country")}
            options={RIGHTS_COUNTRIES.map((c) => ({ value: c, label: t(`countries.${c}`) }))}
          />
        </div>

        <div>
          <span className="text-[13px] text-ink-soft block mb-2">{t("q.age")}</span>
          <RadioChips
            value={profile.ageGroup}
            onChange={(a) => setProfile({ ...profile, ageGroup: a })}
            ariaLabel={t("q.age")}
            options={AGE_GROUPS.map((a) => ({ value: a, label: t(`q.ages.${a}`) }))}
          />
        </div>

        <div>
          <span className="text-[13px] text-ink-soft block mb-2">{t("q.employment")}</span>
          <RadioChips
            value={profile.employment}
            onChange={(e) => setProfile({ ...profile, employment: e })}
            ariaLabel={t("q.employment")}
            options={EMPLOYMENTS.map((e) => ({ value: e, label: t(`q.employments.${e}`) }))}
          />
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
                {/* Zero external links, and no promise without a product
                    behind it. The action expands in place: an in-app tool for
                    rights a tool already covers, the finished letter generated
                    right here for the rest. Rights with no action defined —
                    a country with no JurisdictionPack yet — render nothing
                    rather than a "we'll handle it" button with nothing
                    behind it. */}
                <ClaimDocument rightId={e.id} />
              </details>
            ))}
          </Card>
        </div>
      ))}

      {/* GB, US, DE, FR, CA: a real letter, not just a checklist entry — see
          GLOBAL_MARKET_CODE above for why IL isn't listed here too. */}
      {globalMarket && <GlobalPackRights market={globalMarket} profile={universalProfile} />}

      <p className="mt-6 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}
