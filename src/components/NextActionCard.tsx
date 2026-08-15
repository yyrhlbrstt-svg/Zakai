"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Card } from "@/components/ui";
import { formatAgorot } from "@/lib/money";
import { collectCandidates } from "@/lib/nextAction/collect";
import { pickNext, rankAll } from "@/lib/nextAction/pick";
import type { RightsProfile } from "@/lib/rights";

/**
 * One thing to do, at the top, before anything else.
 *
 * WHY THIS IS THE FIRST THING ON THE SCREEN
 *
 * A person opening a money app has one question and it is not "what is
 * available" — it is "what should I do now". Every screen answering with a menu
 * has handed the work back, and this product currently answers with sixty-four
 * links.
 *
 * The full list is still here, one tap away, because hiding it would be
 * paternalistic and people who want to browse should be able to. But it is
 * closed by default and the default is a single action, which is the whole
 * design.
 *
 * WHAT THE FRAMING IS ALLOWED TO DO
 *
 * The reason line is drawn from a closed set and every member of it is a
 * checkable claim: this expires on a date, this repeats every month, this is
 * the largest, this is the fastest. The card is not permitted to say anything
 * that would still read as true if the underlying fact were false — which rules
 * out urgency language on anything without a real clock, and is why the
 * component takes the reason from the ranker rather than choosing its own.
 */
export function NextActionCard({
  profile,
  actedOn,
  bcp47,
}: {
  profile: RightsProfile;
  actedOn?: readonly string[];
  bcp47: string;
}) {
  const t = useTranslations("next");
  // Right names come from the score namespace rather than being restated here.
  // Sixty labels maintained in two places drift, and the one that drifts is the
  // one nobody is looking at.
  const ti = useTranslations("score");
  const [open, setOpen] = useState(false);

  const candidates = useMemo(
    () => collectCandidates({ profile, actedOn }),
    [profile, actedOn],
  );
  const next = useMemo(() => pickNext(candidates), [candidates]);
  const all = useMemo(() => (open ? rankAll(candidates) : []), [candidates, open]);

  // Nothing real to do. Say nothing rather than manufacture a suggestion —
  // the first invented item is the last one anybody believes.
  if (!next) return null;

  const c = next.candidate;
  const money = (minor: number) => formatAgorot(minor, bcp47);
  const label = (id: string) => {
    if (id === "dormant") return t("labels.dormant");
    if (id === "captive") return t("labels.captive");
    return ti.has(`items.${id}`) ? ti(`items.${id}`) : id;
  };

  return (
    <Card className="p-6 mb-5 border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.07)]">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[12px] font-extrabold text-emerald">{t("kicker")}</span>
        {/* Endowed progress: stated as a position in a short sequence rather
            than as a count of outstanding work, which reads as a backlog. */}
        <span className="text-[11.5px] text-ink-soft">
          {t("progress", { step: next.step, total: next.totalOpen })}
        </span>
      </div>

      <h2 className="font-display text-2xl mt-2 mb-1">{label(c.id.split(":")[0])}</h2>

      {c.valueMinor > 0 && (
        <div className="font-display text-3xl mb-1" dir="ltr">
          {money(c.valueMinor)}
        </div>
      )}

      <p className="text-ink-soft text-body m-0 mb-4 leading-relaxed">
        {c.daysLeft !== null && next.because === "expiring"
          ? t("because.expiring", { days: c.daysLeft })
          : t(`because.${next.because}`)}
      </p>

      {/* Implementation intention: the concrete first move, not encouragement.
          Naming what to do roughly doubles follow-through against intent alone. */}
      <Link
        href={c.href}
        className="inline-flex items-center gap-1.5 text-[13.5px] font-extrabold text-[#06121A] bg-emerald rounded-full px-5 py-2.5 no-underline hover:opacity-90 transition-opacity"
      >
        {t("cta")}
      </Link>

      {next.totalOpen > 1 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="bg-transparent border-0 p-0 py-1 min-h-[24px] inline-flex items-center cursor-pointer text-ink-soft text-caption underline"
          >
            {open ? t("hideAll") : t("showAll", { count: next.totalOpen - 1 })}
          </button>

          {open && (
            <ul className="mt-3 mb-0 ps-0 list-none flex flex-col gap-2">
              {all.slice(1).map((x) => (
                <li key={x.id} className="flex items-baseline gap-2 flex-wrap">
                  <Link href={x.href} className="text-body font-bold no-underline text-ink">
                    {label(x.id.split(":")[0])}
                  </Link>
                  {x.valueMinor > 0 && (
                    <span className="text-[12px] text-ink-soft" dir="ltr">
                      {money(x.valueMinor)}
                    </span>
                  )}
                  {x.daysLeft !== null && x.absolute && (
                    <span className="text-[11.5px] text-[#f0b45c]">
                      {t("daysLeft", { days: x.daysLeft })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
