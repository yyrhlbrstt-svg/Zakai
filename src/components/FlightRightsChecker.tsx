"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { Card, Button, Input, Textarea, RadioChips } from "@/components/ui";
import { OutcomeReport } from "@/components/OutcomeReport";
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
 * Statutory flight-rights checker + agent path.
 * Two jurisdictions, both deterministic. When entitled, the user can open a
 * full Case (vertical=airline) with Mandate + follow-up — same closed loop as
 * cancel / telecom.
 */
export function FlightRightsChecker({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("flights");
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const tIcomponents_FlightRightsChecker = useTranslations("inline_components_FlightRightsChecker");
  const router = useRouter();

  const [jurisdiction, setJurisdiction] = useState<"il" | "eu">("il");
  const [kind, setKind] = useState<"cancelled" | "delay">("cancelled");
  const [tier, setTier] = useState<DistanceTier>("medium");
  const [ilDelay, setIlDelay] = useState<number>(9);
  const [euDelay, setEuDelay] = useState<number>(6);
  const [shortNotice, setShortNotice] = useState(true);
  const [letterOpen, setLetterOpen] = useState(false);
  const [letter, setLetter] = useState("");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    name: "",
    airline: "",
    flightNumber: "",
    flightDate: "",
    route: "",
  });
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const radios = <T extends string | number | boolean>(
    label: string,
    options: readonly T[],
    value: T,
    set: (v: T) => void,
    render: (v: T) => string,
  ) => (
    <div className="mt-5 first:mt-0">
      <span className="text-[13.5px] text-ink-soft block mb-2">{label}</span>
      <RadioChips
        value={String(value)}
        onChange={(v) => {
          const found = options.find((o) => String(o) === v);
          if (found !== undefined) set(found);
        }}
        ariaLabel={label}
        options={options.map((o) => ({ value: String(o), label: render(o) }))}
      />
    </div>
  );

  const formComplete = Object.values(form).every((v) => v.trim().length > 0);

  async function sendWithAgent() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/flight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passengerName: form.name,
          airline: form.airline,
          flightNumber: form.flightNumber,
          flightDate: form.flightDate,
          route: form.route,
          jurisdiction,
          kind,
          tier,
          noticeDaysAhead: kind === "cancelled" ? (shortNotice ? 0 : 14) : undefined,
          delayHours: kind === "delay" ? (isEU ? euDelay : ilDelay) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=/flights`);
        return;
      }
      if (!res.ok) {
        setError(
          data.error === "caseLimit"
            ? he
              ? "הגעת למגבלת התיקים. שדרג או סגור תיק קיים."
              : "Case limit reached. Upgrade or close an open case."
            : he
              ? "משהו השתבש. נסה שוב."
              : "Something went wrong. Try again.",
        );
        return;
      }
      setLetter(data.body || "");
      setCaseId(data.caseId);
    } catch {
      setError(he ? "משהו השתבש. נסה שוב." : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

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
            ? radios(
                t("delayQ"),
                EU_DELAYS,
                euDelay as (typeof EU_DELAYS)[number],
                setEuDelay,
                (h) => t(`euDelayOptions.${String(h).replace(".", "_")}`),
              )
            : radios(
                t("delayQ"),
                IL_DELAYS,
                ilDelay as (typeof IL_DELAYS)[number],
                setIlDelay,
                (h) => t(`delayOptions.${h}`),
              )}
        {radios(
          t("distanceQ"),
          (isEU ? EU_TIERS : IL_TIERS) as readonly DistanceTier[],
          tier,
          setTier,
          (tr) => t(`${isEU ? "euTiers" : "tiers"}.${tr}`),
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
                  <span className="text-emerald font-black" aria-hidden>
                    ✓
                  </span>
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
                  <span className="text-emerald font-black" aria-hidden>
                    ✓
                  </span>
                  <span className="text-[14.5px]">{t("refund")}</span>
                </li>
              )}
              {result.assistance && (
                <li className="flex gap-2.5 items-baseline">
                  <span className="text-emerald font-black" aria-hidden>
                    ✓
                  </span>
                  <span className="text-[14.5px]">{t("assistance")}</span>
                </li>
              )}
            </ul>
          </>
        )}
        <div
          className="mt-4 pt-4 flex flex-col gap-1.5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          {result.noteKeys.map((k) => (
            <p key={k} className="m-0 text-[12px] text-ink-soft leading-snug">
              {t(`notes.${k}`)}
            </p>
          ))}
        </div>
      </Card>

      {/* Agent path + demand letter */}
      {entitled && (
        <Card className="mt-5 p-6">
          {!letterOpen && !caseId ? (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 basis-[240px]">
                <div className="font-extrabold text-[15px]">{t("letter.title")}</div>
                <p className="text-ink-soft text-[13px] mt-1 mb-0 leading-relaxed">{t("letter.sub")}</p>
              </div>
              <Button variant="ghost" onClick={() => setLetterOpen(true)}>
                {t("letter.openBtn")}
              </Button>
            </div>
          ) : caseId ? (
            <div>
              <div className="text-emerald font-extrabold text-[15px]">
                {tIcomponents_FlightRightsChecker("t_360e126e")}
              </div>
              <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed mb-3">
                {tIcomponents_FlightRightsChecker("t_eb212a88")}
              </p>
              <Link href="/dashboard">
                <Button className="w-full">
                  {tIcomponents_FlightRightsChecker("t_4a0f7a8f")}
                </Button>
              </Link>
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

              <div className="flex flex-col gap-2 mt-4">
                <Button
                  className="!px-5 !py-3 !text-[14.5px]"
                  disabled={!formComplete || busy}
                  onClick={sendWithAgent}
                >
                  {busy
                    ? he
                      ? "הסוכן פותח תיק…"
                      : "Agent opening case…"
                    : he
                      ? "הסוכן שולח ומעקוב עכשיו"
                      : "Agent sends & tracks now"}
                </Button>
                <Button
                  variant="ghost"
                  className="!text-[13px]"
                  disabled={!formComplete || busy}
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
                            : {
                                kind,
                                delayHours: isEU ? euDelay : ilDelay,
                                tier,
                              },
                      }),
                    )
                  }
                >
                  {tIcomponents_FlightRightsChecker("t_b4c9b341")}
                </Button>
              </div>
              {error && <p className="text-[13px] text-amber mt-2 mb-0">{error}</p>}

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
                  <OutcomeReport
                    market={isEU ? "EU" : "IL"}
                    vertical="flights"
                    counterparty="airline"
                    variantId={`${jurisdiction}_${kind}`}
                  />
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
