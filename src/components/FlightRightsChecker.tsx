"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Button, Input, Textarea } from "@/components/ui";
import {
  computeEntitlement,
  computeEntitlementEU,
  type DistanceTier,
  type EuDistanceTier,
} from "@/lib/flightRights";
import { buildFlightDemandLetter } from "@/lib/flightLetter";
import { formatAgorot } from "@/lib/money";

const IL_TIERS: DistanceTier[] = ["short", "medium", "long"];
const EU_TIERS: EuDistanceTier[] = ["short", "medium", "long"];
const IL_DELAYS = [1, 3, 6, 9] as const;
const EU_DELAYS = [1, 2.5, 4, 6] as const;

/**
 * Statutory flight-rights checker. Two jurisdictions, both deterministic:
 * the Israeli Aviation Services Law and EU Regulation EC 261/2004 (flights
 * from the EU, or into the EU on an EU carrier) — for connections via
 * Europe and for users from abroad. Pure client-side.
 */
export function FlightRightsChecker({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("flights");
  const [jurisdiction, setJurisdiction] = useState<"il" | "eu">("il");
  const [kind, setKind] = useState<"cancelled" | "delay">("cancelled");
  const [tier, setTier] = useState<DistanceTier>("medium");
  const [ilDelay, setIlDelay] = useState<number>(9);
  const [euDelay, setEuDelay] = useState<number>(6);
  const [shortNotice, setShortNotice] = useState(true);
  const [letterOpen, setLetterOpen] = useState(false);
  const [letter, setLetter] = useState("");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ name: "", airline: "", flightNumber: "", flightDate: "", route: "" });

  const il = useMemo(
    () =>
      computeEntitlement(
        kind === "cancelled"
          ? { kind, noticeDaysAhead: shortNotice ? 0 : 14, tier }
          : { kind, delayHours: ilDelay, tier },
      ),
    [kind, tier, ilDelay, shortNotice],
  );
  const eu = useMemo(
    () =>
      computeEntitlementEU(
        kind === "cancelled"
          ? { kind, noticeDaysAhead: shortNotice ? 0 : 14, tier }
          : { kind, delayHours: euDelay, tier },
      ),
    [kind, tier, euDelay, shortNotice],
  );

  const isEU = jurisdiction === "eu";
  const result = isEU ? eu : il;
  const compensationLabel = isEU
    ? eu.compensationEur > 0
      ? `€${eu.compensationEur}`
      : ""
    : il.compensationAgorot > 0
      ? formatAgorot(il.compensationAgorot, bcp47)
      : "";
  const entitled =
    result.assistance || result.refundOrAlternative || compensationLabel !== "";

  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-[13px] font-bold cursor-pointer border transition-colors duration-200 ${
      active
        ? "bg-[rgba(63,203,155,0.14)] border-[rgba(63,203,155,0.5)] text-emerald"
        : "bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-ink-soft hover:border-[rgba(255,255,255,0.2)]"
    }`;

  const radios = <T extends string | number | boolean>(
    label: string,
    options: readonly T[],
    value: T,
    set: (v: T) => void,
    render: (v: T) => string,
  ) => (
    <div className="mt-5 first:mt-0">
      <span className="text-[13.5px] text-ink-soft block mb-2">{label}</span>
      <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={String(o)} type="button" role="radio" aria-checked={value === o}
            onClick={() => set(o)} className={chip(value === o)}>
            {render(o)}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <Card className="p-6">
        {radios(t("jurisdictionQ"), ["il", "eu"] as const, jurisdiction, setJurisdiction, (j) =>
          t(`jurisdictions.${j}`),
        )}
        {radios(t("whatHappened"), ["cancelled", "delay"] as const, kind, setKind, (k) =>
          k === "cancelled" ? t("cancelled") : t("delayed"),
        )}
        {kind === "cancelled"
          ? radios(t("noticeQ"), [true, false] as const, shortNotice, setShortNotice, (v) =>
              v ? t("noticeShort") : t("noticeLong"),
            )
          : isEU
            ? radios(t("delayQ"), EU_DELAYS, euDelay as (typeof EU_DELAYS)[number], setEuDelay, (h) =>
                t(`euDelayOptions.${String(h).replace(".", "_")}`),
              )
            : radios(t("delayQ"), IL_DELAYS, ilDelay as (typeof IL_DELAYS)[number], setIlDelay, (h) =>
                t(`delayOptions.${h}`),
              )}
        {radios(t("distanceQ"), (isEU ? EU_TIERS : IL_TIERS) as readonly DistanceTier[], tier, setTier, (tr) =>
          t(`${isEU ? "euTiers" : "tiers"}.${tr}`),
        )}
      </Card>

      <Card className="mt-5 p-6">
        {!entitled ? (
          <p className="m-0 text-[14.5px] leading-relaxed text-ink-soft">{t("notEntitled")}</p>
        ) : (
          <>
            <div className="text-[13px] text-ink-soft font-bold mb-3">{t("resultTitle")}</div>
            <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
              {compensationLabel && (
                <li className="flex gap-2.5 items-baseline">
                  <span className="text-emerald font-black" aria-hidden>✓</span>
                  <span className="text-[15px]">
                    {t("compensation")}{" "}
                    <strong className="font-display text-xl text-emerald" dir="ltr">
                      {compensationLabel}
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

      {/* Demand-letter generator: Zakai drafts, the passenger sends in their
          own name. Everything renders in the browser — nothing is uploaded. */}
      {entitled && (
        <Card className="mt-5 p-6">
          {!letterOpen ? (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 basis-[240px]">
                <div className="font-extrabold text-[15px]">{t("letter.title")}</div>
                <p className="text-ink-soft text-[13px] mt-1 mb-0 leading-relaxed">{t("letter.sub")}</p>
              </div>
              <Button variant="ghost" onClick={() => setLetterOpen(true)}>
                {t("letter.openBtn")}
              </Button>
            </div>
          ) : (
            <>
              <div className="font-extrabold text-[15px] mb-3">{t("letter.title")}</div>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                {(
                  [
                    ["name", "letter.name"],
                    ["airline", "letter.airline"],
                    ["flightNumber", "letter.flightNumber"],
                    ["flightDate", "letter.flightDate"],
                    ["route", "letter.route"],
                  ] as const
                ).map(([field, key]) => (
                  <label key={field} className="block">
                    <span className="text-[12.5px] text-ink-soft">{t(key)}</span>
                    <Input
                      value={form[field]}
                      onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                      className="mt-1 !py-2.5 !text-[14px]"
                    />
                  </label>
                ))}
              </div>
              <Button
                className="mt-4 !px-5 !py-3 !text-[14.5px]"
                disabled={Object.values(form).some((v) => v.trim().length === 0)}
                onClick={() =>
                  setLetter(
                    buildFlightDemandLetter({
                      passengerName: form.name,
                      airline: form.airline,
                      flightNumber: form.flightNumber,
                      flightDate: form.flightDate,
                      route: form.route,
                      jurisdiction,
                      disruption:
                        kind === "cancelled"
                          ? { kind, noticeDaysAhead: shortNotice ? 0 : 14, tier }
                          : { kind, delayHours: isEU ? euDelay : ilDelay, tier },
                    }),
                  )
                }
              >
                {t("letter.generateBtn")}
              </Button>

              {letter && (
                <div className="mt-4">
                  <Textarea readOnly value={letter} rows={14} className="!text-[13px]" dir="rtl" />
                  <div className="flex gap-3 mt-3 flex-wrap items-center">
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(letter);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        } catch {
                          /* text stays selectable */
                        }
                      }}
                    >
                      {copied ? t("letter.copied") : t("letter.copyBtn")}
                    </Button>
                    <span className="text-[12px] text-ink-soft">{t("letter.sendHint")}</span>
                  </div>
                </div>
              )}
              <p className="text-[11px] text-ink-soft mt-3 mb-0 leading-snug">{t("letter.privacy")}</p>
              <p className="text-[11.5px] text-ink-soft mt-2 mb-0 leading-relaxed border border-[rgba(240,180,92,0.28)] bg-[rgba(240,180,92,0.06)] rounded-xl px-3 py-2.5">
                {t("letter.legal")}
              </p>
            </>
          )}
        </Card>
      )}

      <p className="mt-5 text-[11.5px] text-ink-soft leading-relaxed">
        {isEU ? t("euDisclaimer") : t("disclaimer")}
      </p>
    </div>
  );
}
