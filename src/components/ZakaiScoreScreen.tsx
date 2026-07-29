"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { ClaimDocument } from "@/components/ClaimDocument";
import { CaptiveCard } from "@/components/CaptiveCard";
import { MoneyCategories } from "@/components/MoneyCategories";
import { evaluateRights, type RightsProfile } from "@/lib/rights";
import { formatAgorot } from "@/lib/money";
import {
  DEFAULT_PROFILE,
  completeness,
  loadProfile,
  saveProfile,
  type StoredProfile,
} from "@/lib/profile/store";
import { computeEntitlementScore } from "@/lib/score/entitlementScore";
import { summariseWatch } from "@/lib/vigil/watch";

const AGE_GROUPS = ["18_24", "25_44", "45_66", "67_plus"] as const;
const EMPLOYMENTS = ["employee", "self_employed", "unemployed", "student", "soldier", "retired"] as const;
const FLAGS = ["renting", "lowIncome", "newImmigrant", "dischargedSoldier", "reservist", "disability"] as const;

/**
 * The optional second row.
 *
 * Deliberately behind its own heading and below the money. None of these can
 * be inferred from anything — nobody's age tells you they sold a flat — and
 * each unlocks either a tax credit worth thousands a year or a captive price
 * that repeats monthly for a decade. Putting them in the first eight taps
 * would rebuild the wall the profile exists to remove; leaving them out
 * entirely would cost people the largest single sums in the product.
 */
const EXTRA_FLAGS = [
  "hasMortgage",
  "specialNeedsChild",
  "withdrewProvidentFund",
  "soldProperty",
  "livesInEligibleTown",
  "hasCarLoan",
  "spendsForeignCurrency",
  "holdsSecurities",
] as const;

/**
 * The Zakai Score screen.
 *
 * Eight taps, no free text, no camera, no bank connection — and it remembers,
 * so the ninth visit asks nothing at all. The number is the handle; the money
 * is the message, so the shekel figure is the largest thing on the screen and
 * the score sits under it.
 *
 * The gaps expand into the same in-app document component the rights list uses.
 * A screen that tells you what you are owed and then hands you off somewhere
 * else to get it is the pattern this whole product exists to stop.
 */
export function ZakaiScoreScreen({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("score");
  const [stored, setStored] = useState<StoredProfile | null>(null);
  const [profile, setProfile] = useState<RightsProfile>(DEFAULT_PROFILE);
  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState(false);

  // Restore on mount. Server-rendered markup cannot know what is on the device,
  // so the questions only appear once we know whether they were already
  // answered — otherwise a returning user is shown the quiz for a frame.
  useEffect(() => {
    const existing = loadProfile();
    if (existing) {
      setStored(existing);
      setProfile(existing.profile);
    } else {
      setEditing(true);
    }
    setHydrated(true);
  }, []);

  function update(next: RightsProfile) {
    setProfile(next);
    saveProfile(next, stored?.actedOn ?? []);
    setStored(loadProfile());

    // Mirror to the account so the Vigil can run while the app is closed. A
    // watchdog that only works when you are already looking is not a watchdog.
    // Fails silently on 401: someone with no account keeps their answers on
    // their own device, which is the whole point of storing them there first.
    void fetch("/api/vigil/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => {});
  }

  const result = useMemo(() => {
    const rights = evaluateRights(profile);
    return computeEntitlementScore({
      eligible: rights.matches.map((e) => ({
        id: e.id,
        yearlyMinor: e.yearlyAgorot,
        oneTimeMinor: e.oneTimeAgorot,
      })),
      actedOn: stored?.actedOn ?? [],
      recovered: [],
      recoveredMinor: 0,
      profileCompleteness: completeness(stored),
    });
  }, [profile, stored]);

  // The countdown. Computed from the same profile with nothing extra asked —
  // this is the part a chat assistant cannot do, so it goes above the score.
  const watch = useMemo(() => {
    const rights = evaluateRights(profile);
    return summariseWatch({
      profile,
      eligible: rights.matches.map((e) => ({
        id: e.id,
        yearlyMinor: e.yearlyAgorot,
        oneTimeMinor: e.oneTimeAgorot,
      })),
      actedOn: stored?.actedOn ?? [],
    });
  }, [profile, stored]);

  const money = (agorot: number) => formatAgorot(agorot, bcp47);

  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-[13px] font-bold cursor-pointer border transition-colors duration-200 ${
      active
        ? "bg-[rgba(63,203,155,0.14)] border-[rgba(63,203,155,0.5)] text-emerald"
        : "bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-ink-soft hover:border-[rgba(255,255,255,0.2)]"
    }`;

  if (!hydrated) {
    return <Card className="p-7 text-center text-ink-soft text-[14px]">{t("loading")}</Card>;
  }

  return (
    <div>
      {/* What is about to be lost comes before what is owed. Money with a date
          on it is the only thing here a person cannot get from a chat, and
          burying it under a total would waste the one real advantage. */}
      {watch.mostUrgent && watch.atRiskSoonMinor > 0 && (
        <Card className="p-6 mb-5 border-[rgba(240,180,92,0.45)] bg-[rgba(240,180,92,0.07)]">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[13px] font-extrabold text-[#f0b45c]">
              {t("watch.title")}
            </span>
            <span className="text-[12px] text-ink-soft">
              {t("watch.deadlineIn", { days: watch.mostUrgent.daysLeft ?? 0 })}
            </span>
          </div>
          <div className="font-display text-3xl mt-2" dir="ltr">
            {money(watch.atRiskSoonMinor)}
          </div>
          <p className="text-ink-soft text-[13px] mt-2 mb-0 leading-relaxed">
            {t("watch.sub")}
          </p>
        </Card>
      )}

      {/* The money first. The score is a handle for it, not the point. */}
      <Card className="p-7 text-center">
        <p className="text-ink-soft text-[13.5px] m-0 mb-2">{t("unclaimedLabel")}</p>
        <div className="font-display grad-text text-[42px] leading-tight" dir="ltr">
          {money(result.unclaimedMinor)}
        </div>
        <p className="text-ink-soft text-[13px] mt-3 mb-0 leading-relaxed">
          {t("summary", { eligible: result.eligibleCount, acted: result.actedOnCount })}
        </p>

        <div className="mt-6 pt-5 border-t border-[rgba(255,255,255,0.08)]">
          <div className="flex items-baseline justify-center gap-2">
            <span className="font-display text-3xl" dir="ltr">
              {result.score}
            </span>
            <span className="text-ink-soft text-[13px]">/ 1000</span>
          </div>
          <p className="text-emerald font-extrabold text-[13.5px] mt-1.5 mb-0">
            {t(`bands.${result.band}`)}
          </p>
          <div
            className="mt-3 h-2 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden"
            role="progressbar"
            aria-valuenow={result.score}
            aria-valuemin={0}
            aria-valuemax={1000}
          >
            <div
              className="h-full grad-bg transition-[width] duration-500 ease-[var(--ease-out)]"
              style={{ width: `${(result.score / 1000) * 100}%` }}
            />
          </div>
        </div>

        {result.unquantifiedCount > 0 && (
          <p className="text-ink-soft text-[11.5px] mt-4 mb-0 leading-relaxed">
            {t("unquantifiedNote", { count: result.unquantifiedCount })}
          </p>
        )}
      </Card>

      {/* Eight taps. Collapsed once answered — a returning user sees the money,
          not the quiz. */}
      <Card className="mt-5 p-6">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="w-full flex items-center justify-between bg-transparent border-0 cursor-pointer p-0 text-start"
        >
          <span className="font-extrabold text-[14.5px]">{t("aboutYou")}</span>
          <span className="text-ink-soft text-[12.5px]">{editing ? t("hide") : t("edit")}</span>
        </button>

        {editing && (
          <div className="mt-5 flex flex-col gap-5">
            <div>
              <span className="text-[13px] text-ink-soft block mb-2">{t("q.age")}</span>
              <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={t("q.age")}>
                {AGE_GROUPS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={profile.ageGroup === g}
                    onClick={() => update({ ...profile, ageGroup: g })}
                    className={chip(profile.ageGroup === g)}
                  >
                    {t(`q.ages.${g}`)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[13px] text-ink-soft block mb-2">{t("q.employment")}</span>
              <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={t("q.employment")}>
                {EMPLOYMENTS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    role="radio"
                    aria-checked={profile.employment === e}
                    onClick={() => update({ ...profile, employment: e })}
                    className={chip(profile.employment === e)}
                  >
                    {t(`q.employments.${e}`)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[13px] text-ink-soft block mb-2">{t("q.children")}</span>
              <div className="flex gap-2 flex-wrap">
                {[0, 1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={profile.children === n}
                    onClick={() =>
                      update({
                        ...profile,
                        children: n,
                        childrenUnder6: Math.min(profile.childrenUnder6, n),
                      })
                    }
                    className={chip(profile.children === n)}
                  >
                    {n === 4 ? "4+" : n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[13px] text-ink-soft block mb-2">{t("q.flags")}</span>
              <div className="flex gap-2 flex-wrap">
                {FLAGS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={profile[f]}
                    onClick={() => update({ ...profile, [f]: !profile[f] })}
                    className={chip(profile[f])}
                  >
                    {t(`q.${f}`)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[13px] text-ink-soft block mb-1">{t("q.moreTitle")}</span>
              <span className="text-[11.5px] text-ink-soft block mb-2 leading-relaxed">
                {t("q.moreHint")}
              </span>
              <div className="flex gap-2 flex-wrap">
                {EXTRA_FLAGS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={profile[f] === true}
                    onClick={() => update({ ...profile, [f]: !profile[f] })}
                    className={chip(profile[f] === true)}
                  >
                    {t(`q.${f}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* One number, and the highest-yield question in the product per
                tap: it expands into one disclosure demand per employment era. */}
            <div>
              <span className="text-[13px] text-ink-soft block mb-2">{t("q.pastEmployers")}</span>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={profile.pastEmployers === n}
                    onClick={() => update({ ...profile, pastEmployers: n })}
                    className={chip(profile.pastEmployers === n)}
                  >
                    {n === 6 ? "6+" : n}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11.5px] text-ink-soft m-0 leading-relaxed">{t("privacyNote")}</p>
          </div>
        )}
      </Card>

      {/* The remaining categories, converged onto the same profile so nobody is
          asked anything twice. */}
      <MoneyCategories profile={profile} />

      {/* Captive pricing. Below the entitlements because it needs a number
          from them, and above nothing else because it is the largest recurring
          money in the product. */}
      <CaptiveCard profile={profile} bcp47={bcp47} />

      {/* What to do next, most valuable first, fulfilled in place. */}
      {result.gaps.length > 0 && (
        <div className="mt-6">
          <h2 className="text-[15px] font-extrabold mb-3">{t("nextTitle")}</h2>
          <Card className="py-1">
            {result.gaps.slice(0, 8).map((gap, i, arr) => (
              <details
                key={gap.rightId}
                className="px-5 py-3.5"
                style={{
                  borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                }}
              >
                <summary className="cursor-pointer flex items-center gap-3 flex-wrap list-none">
                  <span className="font-extrabold text-[14.5px] flex-1 basis-[200px]">
                    {t.has(`items.${gap.rightId}`) ? t(`items.${gap.rightId}`) : gap.rightId}
                  </span>
                  <span className="text-[11.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-2.5 py-1">
                    {gap.unquantified ? t("varies") : money(gap.valueMinor)}
                  </span>
                </summary>
                <ClaimDocument rightId={gap.rightId} />
              </details>
            ))}
          </Card>
        </div>
      )}

      <p className="mt-6 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}
