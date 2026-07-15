"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Card, Button, FieldError } from "@/components/ui";
import { SpotlightCard } from "@/components/SpotlightCard";
import { PLANS, PLAN_IDS, type PlanId } from "@/lib/plans";
import { formatAgorot } from "@/lib/money";

/**
 * The three tier cards. `currentPlan` is null for logged-out visitors — the
 * button then routes to signup instead of switching plans.
 */
export function PlanCards({
  currentPlan,
  bcp47,
}: {
  currentPlan: PlanId | null;
  bcp47: string;
}) {
  const t = useTranslations("pricing");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, setPending] = useState<PlanId | null>(null);
  const [error, setError] = useState(false);

  async function choose(plan: PlanId) {
    if (!currentPlan) {
      router.push("/signup");
      return;
    }
    setError(false);
    setPending(plan);
    try {
      const res = await fetch("/api/account/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))] items-stretch">
        {PLAN_IDS.map((id) => {
          const p = PLANS[id];
          const isCurrent = currentPlan === id;
          const highlight = id === "PRO";
          const features = t.raw(`plans.${id}.features`) as string[];
          return (
            <SpotlightCard
              key={id}
              className={`p-6 flex flex-col ${highlight ? "border-[rgba(63,203,155,0.45)]" : ""}`}
            >
              {highlight && (
                <div className="self-start text-[11px] font-extrabold text-[#06121A] grad-bg rounded-full px-2.5 py-1 mb-3">
                  {t("popular")}
                </div>
              )}
              <div className="font-display text-xl">{t(`plans.${id}.name`)}</div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-display text-4xl">
                  {p.priceAgorot === 0 ? t("freePrice") : formatAgorot(p.priceAgorot, bcp47)}
                </span>
                {p.priceAgorot > 0 && (
                  <span className="text-ink-soft text-[13px]">{t("perMonth")}</span>
                )}
              </div>
              <div className="text-emerald font-extrabold text-[14px] mt-1.5">
                {t(`plans.${id}.fee`)}
              </div>
              <ul className="mt-4 flex flex-col gap-2 list-none p-0 m-0 flex-1">
                {features.map((f) => (
                  <li key={f} className="flex gap-2.5 items-start text-[13.5px] text-ink-soft">
                    <span className="text-emerald font-black shrink-0" aria-hidden>
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={highlight ? "primary" : "ghost"}
                className="w-full mt-5"
                disabled={isCurrent || pending !== null}
                onClick={() => choose(id)}
              >
                {isCurrent ? t("currentPlan") : pending === id ? "…" : t("choose")}
              </Button>
            </SpotlightCard>
          );
        })}
      </div>

      {error && (
        <Card className="mt-4 p-4">
          <FieldError>{tc("genericError")}</FieldError>
        </Card>
      )}

      <p className="mt-5 text-[12px] text-ink-soft leading-relaxed text-center max-w-[560px] mx-auto">
        {t("billingNote")}
      </p>
    </div>
  );
}
