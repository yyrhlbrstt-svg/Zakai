"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { computeEntitlement, type DistanceTier } from "@/lib/flightRights";
import { formatAgorot } from "@/lib/money";

const TIERS: DistanceTier[] = ["short", "medium", "long"];
const DELAYS = [1, 3, 6, 9] as const;

/**
 * Statutory flight-rights checker (Aviation Services Law 2012). Pure
 * client-side; three taps to an answer. Acting on the claim (demand letter
 * with power of attorney, like telecom) is the next stage — BACKLOG.
 */
export function FlightRightsChecker({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("flights");
  const [kind, setKind] = useState<"cancelled" | "delay">("cancelled");
  const [tier, setTier] = useState<DistanceTier>("medium");
  const [delayHours, setDelayHours] = useState<number>(9);
  const [shortNotice, setShortNotice] = useState(true);

  const result = useMemo(
    () =>
      computeEntitlement(
        kind === "cancelled"
          ? { kind, noticeDaysAhead: shortNotice ? 0 : 14, tier }
          : { kind, delayHours, tier },
      ),
    [kind, tier, delayHours, shortNotice],
  );

  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-[13px] font-bold cursor-pointer border transition-colors duration-200 ${
      active
        ? "bg-[rgba(63,203,155,0.14)] border-[rgba(63,203,155,0.5)] text-emerald"
        : "bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-ink-soft hover:border-[rgba(255,255,255,0.2)]"
    }`;

  const entitled =
    result.assistance || result.refundOrAlternative || result.compensationAgorot > 0;

  return (
    <div>
      <Card className="p-6">
        <span className="text-[13.5px] text-ink-soft block mb-2">{t("whatHappened")}</span>
        <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={t("whatHappened")}>
          <button type="button" role="radio" aria-checked={kind === "cancelled"} onClick={() => setKind("cancelled")} className={chip(kind === "cancelled")}>
            {t("cancelled")}
          </button>
          <button type="button" role="radio" aria-checked={kind === "delay"} onClick={() => setKind("delay")} className={chip(kind === "delay")}>
            {t("delayed")}
          </button>
        </div>

        {kind === "cancelled" ? (
          <div className="mt-5">
            <span className="text-[13.5px] text-ink-soft block mb-2">{t("noticeQ")}</span>
            <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={t("noticeQ")}>
              <button type="button" role="radio" aria-checked={shortNotice} onClick={() => setShortNotice(true)} className={chip(shortNotice)}>
                {t("noticeShort")}
              </button>
              <button type="button" role="radio" aria-checked={!shortNotice} onClick={() => setShortNotice(false)} className={chip(!shortNotice)}>
                {t("noticeLong")}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <span className="text-[13.5px] text-ink-soft block mb-2">{t("delayQ")}</span>
            <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={t("delayQ")}>
              {DELAYS.map((h) => (
                <button key={h} type="button" role="radio" aria-checked={delayHours === h} onClick={() => setDelayHours(h)} className={chip(delayHours === h)}>
                  {t(`delayOptions.${h}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5">
          <span className="text-[13.5px] text-ink-soft block mb-2">{t("distanceQ")}</span>
          <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={t("distanceQ")}>
            {TIERS.map((tr) => (
              <button key={tr} type="button" role="radio" aria-checked={tier === tr} onClick={() => setTier(tr)} className={chip(tier === tr)}>
                {t(`tiers.${tr}`)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="mt-5 p-6">
        {!entitled ? (
          <p className="m-0 text-[14.5px] leading-relaxed text-ink-soft">{t("notEntitled")}</p>
        ) : (
          <>
            <div className="text-[13px] text-ink-soft font-bold mb-3">{t("resultTitle")}</div>
            <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
              {result.compensationAgorot > 0 && (
                <li className="flex gap-2.5 items-baseline">
                  <span className="text-emerald font-black" aria-hidden>✓</span>
                  <span className="text-[15px]">
                    {t("compensation")}{" "}
                    <strong className="font-display text-xl text-emerald">
                      {formatAgorot(result.compensationAgorot, bcp47)}
                    </strong>
                  </span>
                </li>
              )}
              {result.refundOrAlternative && (
                <li className="flex gap-2.5 items-baseline">
                  <span className="text-emerald font-black" aria-hidden>✓</span>
                  <span className="text-[14.5px]">{t("refund")}</span>
                </li>
              )}
              {result.assistance && (
                <li className="flex gap-2.5 items-baseline">
                  <span className="text-emerald font-black" aria-hidden>✓</span>
                  <span className="text-[14.5px]">{t("assistance")}</span>
                </li>
              )}
            </ul>
          </>
        )}
        <div className="mt-4 pt-4 flex flex-col gap-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {result.noteKeys.map((k) => (
            <p key={k} className="m-0 text-[12px] text-ink-soft leading-snug">
              {t(`notes.${k}`)}
            </p>
          ))}
        </div>
      </Card>

      <p className="mt-5 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}
