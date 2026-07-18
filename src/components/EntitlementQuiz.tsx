"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { FallNumber } from "@/components/FallNumber";
import { evaluateRights, type RightsProfile } from "@/lib/rights";

const AGES = ["18_24", "25_44", "45_66", "67_plus"] as const;
const EMPLOYMENTS = [
  "employee",
  "self_employed",
  "unemployed",
  "student",
  "soldier",
  "retired",
] as const;
const FLAGS = [
  "renting",
  "lowIncome",
  "reservist",
  "newImmigrant",
  "dischargedSoldier",
  "disability",
] as const;

/** A few matches deep-link to a vertical we already ship; the rest go to /rights. */
const ITEM_LINKS: Record<string, string> = {
  miluim_pay: "/miluim",
  tax_refund: "/rights",
};

const DEFAULT_PROFILE: RightsProfile = {
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
};

type Phase = "intro" | number | "result";

export function EntitlementQuiz({ bcp47 }: { bcp47: string }) {
  const t = useTranslations();
  const [phase, setPhase] = useState<Phase>("intro");
  const [profile, setProfile] = useState<RightsProfile>(DEFAULT_PROFILE);

  const result = useMemo(() => evaluateRights(profile), [profile]);
  const yearly = Math.round(result.quantifiedYearlyAgorot / 100); // agorot → ₪

  // Steps: 0 age · 1 employment · 2 children · 3 flags. childrenUnder6 folds
  // into step 2 only when relevant, so the flow stays short.
  const TOTAL = 4;
  const step = typeof phase === "number" ? phase : 0;

  function set<K extends keyof RightsProfile>(k: K, v: RightsProfile[K]) {
    setProfile((p) => ({ ...p, [k]: v }));
  }

  const chip = (active: boolean) =>
    `px-4 py-3 rounded-xl text-[15px] font-bold border transition-colors duration-200 ${
      active
        ? "bg-[rgba(63,203,155,0.14)] border-emerald text-ink"
        : "bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.1)] text-ink-soft hover:border-[rgba(63,203,155,0.4)]"
    }`;

  // ---- Intro ----
  if (phase === "intro") {
    return (
      <Shell>
        <div className="text-center">
          <div className="text-[40px] mb-3" aria-hidden>
            🎯
          </div>
          <h1 className="font-display text-[clamp(26px,5vw,36px)] leading-tight m-0">
            {t("entitlements.title")}
          </h1>
          <p className="text-ink-soft text-[15.5px] leading-relaxed mt-4 mb-7 max-w-[440px] mx-auto">
            {t("entitlements.sub")}
          </p>
          <Button onClick={() => setPhase(0)}>{t("entitlements.start")}</Button>
          <p className="text-[11.5px] text-ink-soft mt-5">{t("entitlements.privacy")}</p>
        </div>
      </Shell>
    );
  }

  // ---- Result ----
  if (phase === "result") {
    const top = result.matches.slice(0, 24);
    return (
      <Shell>
        <div className="text-center mb-6">
          <div className="text-[12.5px] font-extrabold text-emerald tracking-wide uppercase mb-2">
            {t("entitlements.resultKicker")}
          </div>
          <div className="font-display text-[clamp(44px,12vw,72px)] leading-none grad-text tabular-nums">
            {result.matches.length}
          </div>
          <p className="text-ink text-[15.5px] font-bold mt-2">
            {t("entitlements.foundCount", { count: result.matches.length })}
          </p>
          {yearly > 0 && (
            <p className="text-ink-soft text-[13.5px] mt-2">
              {t("entitlements.worthFrom")}
              <FallNumber from={0} to={yearly} locale={bcp47} />
              {" "}
              {t("entitlements.perYear")}
              <span className="block text-[11.5px] mt-1">{t("entitlements.worthNote")}</span>
            </p>
          )}
        </div>

        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
          {top.map((e) => {
            const href = ITEM_LINKS[e.id];
            const body = (
              <div className="h-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.025)] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-[14px]">
                    {t(`rights.items.${e.id}.title`)}
                  </span>
                  <span className="text-[10px] text-ink-soft border border-[rgba(255,255,255,0.14)] rounded-full px-2 py-0.5 shrink-0">
                    {t(`rights.categories.${e.category}`)}
                  </span>
                </div>
                <p className="text-ink-soft text-[12px] leading-relaxed mt-1.5 mb-0">
                  {t(`rights.items.${e.id}.desc`)}
                </p>
              </div>
            );
            return href ? (
              <Link key={e.id} href={href} className="no-underline text-ink block h-full">
                {body}
              </Link>
            ) : (
              <div key={e.id}>{body}</div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 justify-center mt-8">
          <Link href="/signup">
            <Button>{t("entitlements.ctaSignup")}</Button>
          </Link>
          <Link href="/rights">
            <Button variant="ghost">{t("entitlements.ctaRights")}</Button>
          </Link>
        </div>
        <button
          type="button"
          onClick={() => {
            setProfile(DEFAULT_PROFILE);
            setPhase("intro");
          }}
          className="block mx-auto mt-5 text-[12.5px] text-ink-soft hover:text-emerald bg-transparent border-0 cursor-pointer"
        >
          {t("entitlements.restart")}
        </button>
        <p className="text-[11px] text-ink-soft leading-relaxed text-center mt-6 max-w-[560px] mx-auto">
          {t("rights.disclaimer")}
        </p>
      </Shell>
    );
  }

  // ---- Question steps ----
  return (
    <Shell>
      <Progress step={step} total={TOTAL} label={t("entitlements.step", { n: step + 1, total: TOTAL })} />

      {step === 0 && (
        <Question title={t("rights.q.age")}>
          <div className="flex gap-2.5 flex-wrap">
            {AGES.map((a) => (
              <button
                key={a}
                type="button"
                className={chip(profile.ageGroup === a)}
                onClick={() => {
                  set("ageGroup", a);
                  setPhase(1);
                }}
              >
                {t(`rights.q.ages.${a}`)}
              </button>
            ))}
          </div>
        </Question>
      )}

      {step === 1 && (
        <Question title={t("rights.q.employment")}>
          <div className="flex gap-2.5 flex-wrap">
            {EMPLOYMENTS.map((e) => (
              <button
                key={e}
                type="button"
                className={chip(profile.employment === e)}
                onClick={() => {
                  set("employment", e);
                  setPhase(2);
                }}
              >
                {t(`rights.q.employments.${e}`)}
              </button>
            ))}
          </div>
        </Question>
      )}

      {step === 2 && (
        <Question title={t("rights.q.children")}>
          <Counter value={profile.children} max={8} onChange={(n) => {
            setProfile((p) => ({ ...p, children: n, childrenUnder6: Math.min(p.childrenUnder6, n) }));
          }} />
          {profile.children > 0 && (
            <div className="mt-5">
              <span className="text-[13px] text-ink-soft block mb-2">{t("rights.q.childrenUnder6")}</span>
              <Counter
                value={profile.childrenUnder6}
                max={profile.children}
                onChange={(n) => set("childrenUnder6", n)}
              />
            </div>
          )}
          <StepNav onBack={() => setPhase(1)} onNext={() => setPhase(3)} t={t} />
        </Question>
      )}

      {step === 3 && (
        <Question title={t("rights.q.flags")}>
          <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
            {FLAGS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={profile[f]}
                className={chip(profile[f]) + " text-start leading-snug"}
                onClick={() => set(f, !profile[f])}
              >
                {t(`rights.q.${f}`)}
              </button>
            ))}
          </div>
          <div className="flex gap-3 justify-between mt-7">
            <Button variant="ghost" onClick={() => setPhase(2)}>
              {t("entitlements.back")}
            </Button>
            <Button onClick={() => setPhase("result")}>{t("entitlements.findBtn")}</Button>
          </div>
        </Question>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-8">
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-6 sm:p-8">
        {children}
      </div>
    </main>
  );
}

function Progress({ step, total, label }: { step: number; total: number; label: string }) {
  const pct = ((step + 1) / total) * 100;
  return (
    <div className="mb-6">
      <div className="flex justify-between text-[12px] text-ink-soft mb-2">
        <span>{label}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
        <div
          className="h-full grad-bg rounded-full transition-[width] duration-500 ease-[var(--ease-snappy)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-[22px] leading-snug mb-5">{title}</h2>
      {children}
    </div>
  );
}

function Counter({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const btn =
    "w-11 h-11 rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] text-2xl font-bold text-ink disabled:opacity-30 cursor-pointer active:scale-95 transition-transform";
  return (
    <div className="flex items-center gap-5">
      <button type="button" className={btn} onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0} aria-label="-">
        −
      </button>
      <span className="font-display text-3xl w-10 text-center tabular-nums">{value}</span>
      <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="+">
        +
      </button>
    </div>
  );
}

function StepNav({
  onBack,
  onNext,
  t,
}: {
  onBack: () => void;
  onNext: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex gap-3 justify-between mt-7">
      <Button variant="ghost" onClick={onBack}>
        {t("entitlements.back")}
      </Button>
      <Button onClick={onNext}>{t("entitlements.next")}</Button>
    </div>
  );
}
