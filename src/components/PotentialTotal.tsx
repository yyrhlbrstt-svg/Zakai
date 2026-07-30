"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { Card, Button } from "@/components/ui";
import { ShareResult } from "@/components/ShareResult";
import { computePotentialTotal, type PotentialProfile } from "@/lib/potentialTotal";
import { bcp47, type Locale } from "@/i18n/config";

const QUESTIONS: { key: keyof PotentialProfile; icon: string }[] = [
  { key: "employed", icon: "💼" },
  { key: "ownsHome", icon: "🏠" },
  { key: "hasMortgage", icon: "🏡" },
  { key: "hasPension", icon: "📊" },
  { key: "hasPrivateInsurance", icon: "🛡️" },
  { key: "flewDelayed", icon: "✈️" },
  { key: "rents", icon: "🔑" },
];

/**
 * "How much am I owed?" — the shareable grand total. A few taps produce an
 * honest "up to ₪X worth checking" headline plus a breakdown that links into
 * each vertical to actually verify. Client-side; nothing stored.
 *
 * Every range here is tuned to Israeli law (arnona, Israeli pension rules, the
 * Israeli flight-compensation cap) — real for Israel, not a general-purpose
 * estimator. For a visitor who has already told us they are elsewhere, six of
 * the seven questions would stop affecting the total at all, which reads as
 * broken rather than honest. So `isIsraeli={false}` skips this tool entirely
 * and points to `/rights` instead — the checklist actually built with a real
 * catalog for their own country.
 */
export function PotentialTotal({ isIsraeli = true }: { isIsraeli?: boolean }) {
  const t = useTranslations("potential");
  const tv = useTranslations("home.verticals");
  const locale = useLocale();
  const loc = bcp47[locale as Locale];

  // Hooks first, unconditionally, per the Rules of Hooks — `isIsraeli` is set
  // once from the server and never toggles within a mounted instance, but the
  // early return below still has to come after every hook call, not before.
  const [profile, setProfile] = useState<PotentialProfile>({
    ownsHome: false,
    hasMortgage: false,
    hasPension: false,
    employed: false,
    hasPrivateInsurance: false,
    flewDelayed: false,
    rents: false,
  });
  const [result, setResult] = useState<ReturnType<typeof computePotentialTotal> | null>(null);

  if (!isIsraeli) {
    return (
      <Card className="p-6 text-center">
        <p className="text-ink-soft text-[14px] leading-relaxed mb-4">{t("notIsraelNote")}</p>
        <Link href="/rights">
          <Button>{t("notIsraelCta")}</Button>
        </Link>
      </Card>
    );
  }

  const money = (n: number) => `₪${Math.round(n).toLocaleString(loc)}`;
  const toggle = (k: keyof PotentialProfile) => setProfile((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div>
      <Card className="p-6">
        <div className="text-[13px] text-ink-soft font-bold mb-3">{t("q")}</div>
        <div className="flex flex-wrap gap-2.5">
          {QUESTIONS.map((q) => {
            const on = profile[q.key];
            return (
              <button
                key={q.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(q.key)}
                className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-[13.5px] font-bold border transition-colors duration-200 ${
                  on
                    ? "bg-[rgba(63,203,155,0.14)] border-[rgba(63,203,155,0.55)] text-emerald"
                    : "bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-ink-soft hover:border-[rgba(255,255,255,0.22)]"
                }`}
              >
                <span aria-hidden>{q.icon}</span>
                {t(`options.${q.key}`)}
              </button>
            );
          })}
        </div>
        <Button onClick={() => setResult(computePotentialTotal(profile))} className="mt-5">
          {t("calc")}
        </Button>
      </Card>

      {result && (
        <Card className="mt-5 p-7 relative overflow-hidden">
          <div
            className="absolute -top-[70px] -start-[50px] w-72 h-72 rounded-full"
            style={{ background: "#3FCB9B", filter: "blur(90px)", opacity: 0.24 }}
            aria-hidden
          />
          <div className="relative">
            <div className="text-[13px] text-ink-soft font-bold">{t("resultLabel")}</div>
            <div className="font-display grad-text text-[clamp(38px,11vw,60px)] leading-none mt-2">
              {t("upTo")} {money(result.totalHighShekels)}
            </div>
            <div className="text-[12.5px] text-ink-soft mt-2.5 max-w-[520px] leading-relaxed">
              {t("resultSub", { low: money(result.totalLowShekels) })}
            </div>

            <div className="mt-6 flex flex-col gap-2">
              {result.items.map((it) => (
                <Link
                  key={it.key}
                  href={it.href}
                  className="flex items-center justify-between gap-3 no-underline rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 hover:border-[rgba(63,203,155,0.4)] transition-colors"
                >
                  <span className="text-[14px] font-bold text-ink">{tv(`${it.key}.title`)}</span>
                  <span className="text-[13px] font-extrabold text-emerald shrink-0">
                    {t("upTo")} {money(it.highShekels)}
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-6">
              <ShareResult message={t("shareMsg", { amount: money(result.totalHighShekels) })} path="/what-am-i-owed" />
            </div>

            <p className="text-[11px] text-ink-soft mt-4 mb-0 leading-relaxed border border-[rgba(240,180,92,0.28)] bg-[rgba(240,180,92,0.06)] rounded-xl px-3 py-2.5">
              {t("honest")}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
