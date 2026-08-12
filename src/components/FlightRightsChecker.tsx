"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { hasOutreachEmail, redirectIfOpenLoop } from "@/lib/openLoopClient";
import { Card, Button, Input, Select, Textarea, RadioChips } from "@/components/ui";
import { MissingFields } from "@/components/MissingFields";
import { OutcomeReport } from "@/components/OutcomeReport";
import { VerticalOutcomeStat } from "@/components/VerticalOutcomeStat";
import type { VerticalOutcomeStat as Stat } from "@/lib/strategy/insights";
import {
  computeEntitlement,
  computeEntitlementEU,
  type DistanceTier,
  type EuDistanceTier,
} from "@/lib/flightRights";
import { buildFlightDemandLetter } from "@/lib/flightLetter";
import { KNOWN_AIRLINES, resolveAirlineContactEmail } from "@/lib/airlineContacts";
import { formatAgorot } from "@/lib/money";
import { moneyCaseHref } from "@/lib/moneyCaseHref";

const IL_TIERS: DistanceTier[] = ["short", "medium", "long"];
const EU_TIERS: EuDistanceTier[] = ["short", "medium", "long"];
const IL_DELAYS = [1, 3, 6, 9] as const;
const EU_DELAYS = [1, 2.5, 4, 6] as const;

/**
 * The claim form's fields and their labels, in one place so the inputs and
 * the "still missing" hint cannot disagree about what the form asks for.
 */
const CLAIM_FIELDS = [
  ["name", "letter.name"],
  ["airline", "letter.airline"],
  ["flightNumber", "letter.flightNumber"],
  ["flightDate", "letter.flightDate"],
  ["route", "letter.route"],
] as const;

/** The typed-in fields, in order — the airline is chosen, not typed. */
const TYPED_FIELDS = CLAIM_FIELDS.filter(([field]) => field !== "airline");

/** Sentinel for "my airline isn't on the list", which reopens the text field. */
const OTHER_AIRLINE = "__other__";

/**
 * Statutory flight-rights checker + agent path.
 * Two jurisdictions, both deterministic. When entitled, the user can open a
 * full Case (vertical=airline) with Mandate + follow-up — same closed loop as
 * cancel / telecom.
 */
export function FlightRightsChecker({ bcp47, stat }: { bcp47: string; stat?: Stat | null }) {
  const t = useTranslations("flights");
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const tIcomponents_FlightRightsChecker = useTranslations("inline_components_FlightRightsChecker");
  const tFlow = useTranslations("agentFlow");
  const router = useRouter();

  const [jurisdiction, setJurisdiction] = useState<"il" | "eu">("il");
  const [kind, setKind] = useState<"cancelled" | "delay">("cancelled");
  const [tier, setTier] = useState<DistanceTier>("medium");
  const [ilDelay, setIlDelay] = useState<number>(9);
  const [euDelay, setEuDelay] = useState<number>(6);
  const [shortNotice, setShortNotice] = useState(true);
  const [letter, setLetter] = useState("");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    name: "",
    airline: "",
    flightNumber: "",
    flightDate: "",
    route: "",
  });
  const [airlineEmail, setAirlineEmail] = useState("");
  /** "" = nothing picked yet, a carrier key, or OTHER_AIRLINE for free text. */
  const [airlineChoice, setAirlineChoice] = useState("");
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

  /** One place decides how a carrier's name is written, for list and letter. */
  const airlineLabel = (a: (typeof KNOWN_AIRLINES)[number]) => (he ? a.he : a.en);

  const knownAirlineInbox = resolveAirlineContactEmail(form.airline);
  const formComplete =
    Object.values(form).every((v) => v.trim().length > 0) &&
    (Boolean(knownAirlineInbox) || hasOutreachEmail(airlineEmail));

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
          airlineContactEmail: airlineEmail.trim() || undefined,
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
        if (redirectIfOpenLoop(data, router.push)) return;
        if (data.error === "needsOutreachEmail") {
          setError(tFlow("errorNeedsEmail"));
          return;
        }
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
      router.push(moneyCaseHref(data.caseId, { delivered: data.delivered }));
    } catch {
      setError(he ? "משהו השתבש. נסה שוב." : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {stat && <VerticalOutcomeStat stat={stat} bcp47={bcp47} />}
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

      {/*
       * Agent path + demand letter.
       *
       * The form used to sit behind a "prepare a demand letter for me" button,
       * so answering the questions produced a figure and then a card asking
       * whether you would like to do anything about it. That extra tap is the
       * whole of "it brings me here and then it isn't clear what to do": the
       * answer to "you are owed 2,390" is the claim, not an offer to start one.
       */}
      {entitled && (
        <Card className="mt-5 p-6">
          {caseId ? (
            <div>
              <div className="text-emerald font-extrabold text-[15px]">
                {tIcomponents_FlightRightsChecker("t_360e126e")}
              </div>
              <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed mb-3">
                {tIcomponents_FlightRightsChecker("t_eb212a88")}
              </p>
              <Link href={`/money?case=${caseId}`}>
                <Button className="w-full">
                  {tIcomponents_FlightRightsChecker("t_4a0f7a8f")}
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="font-extrabold text-lead mb-1">{t("letter.formTitle")}</div>
              <p className="text-caption text-ink-soft mt-0 mb-3 leading-relaxed">{t("letter.sub")}</p>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                {/* The airline is picked, not typed. Typing it meant the claim
                    address resolved for one spelling and silently failed for
                    every other, leaving the submit button disabled with nothing
                    on screen explaining why. */}
                <label className="block">
                  <span className="text-caption text-ink-soft">{t("letter.airline")}</span>
                  <Select
                    value={airlineChoice}
                    aria-label={t("letter.airline")}
                    onChange={(e) => {
                      const choice = e.target.value;
                      setAirlineChoice(choice);
                      if (choice === OTHER_AIRLINE || choice === "") {
                        setForm((f) => ({ ...f, airline: "" }));
                        setAirlineEmail("");
                        return;
                      }
                      const picked = KNOWN_AIRLINES.find((a) => a.key === choice);
                      const label = picked ? airlineLabel(picked) : "";
                      setForm((f) => ({ ...f, airline: label }));
                      setAirlineEmail(resolveAirlineContactEmail(label));
                    }}
                    className="mt-1 !py-2.5 !text-body-lg"
                  >
                    <option value="">{t("letter.airlinePlaceholder")}</option>
                    {KNOWN_AIRLINES.map((a) => (
                      <option key={a.key} value={a.key}>
                        {airlineLabel(a)}
                      </option>
                    ))}
                    <option value={OTHER_AIRLINE}>{t("letter.airlineOther")}</option>
                  </Select>
                </label>
                {airlineChoice === OTHER_AIRLINE && (
                  <label className="block">
                    <span className="text-caption text-ink-soft">{t("letter.airlineName")}</span>
                    <Input
                      value={form.airline}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((f) => ({ ...f, airline: value }));
                        const known = resolveAirlineContactEmail(value);
                        if (known) setAirlineEmail(known);
                      }}
                      className="mt-1 !py-2.5 !text-body-lg"
                    />
                  </label>
                )}
                {TYPED_FIELDS.map(([field, key]) => (
                  <label key={field} className="block">
                    <span className="text-[12.5px] text-ink-soft">{t(key)}</span>
                    <Input
                      value={form[field]}
                      onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                      className="mt-1 !py-2.5 !text-[14px]"
                    />
                  </label>
                ))}
                {/* Only asked for when we do not already hold the address. */}
                {!knownAirlineInbox && (
                  <label className="block">
                    <span className="text-[12.5px] text-ink-soft">{tFlow("contactEmail")}</span>
                    <Input
                      type="email"
                      dir="ltr"
                      value={airlineEmail}
                      onChange={(e) => setAirlineEmail(e.target.value)}
                      placeholder={tFlow("contactEmailHint")}
                      className="mt-1 !py-2.5 !text-[14px]"
                    />
                    <span className="mt-1 block text-micro text-ink-soft leading-snug">
                      {t("letter.contactHint")}
                    </span>
                  </label>
                )}
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <MissingFields
                  items={[
                    ...CLAIM_FIELDS.map(([field, key]) => ({
                      ok: form[field].trim().length > 0,
                      label: t(key),
                    })),
                    {
                      ok: Boolean(knownAirlineInbox) || hasOutreachEmail(airlineEmail),
                      label: tFlow("contactEmail"),
                    },
                  ]}
                />
                {/* One dominant action, named after what the passenger wants —
                    the airline they picked and the sum they are owed — rather
                    than after our own machinery ("open a case, continue in the
                    dashboard"). Nobody landed here to open a case. */}
                <Button
                  className="!px-5 !py-3 !text-lead"
                  disabled={!formComplete || busy}
                  onClick={sendWithAgent}
                >
                  {busy
                    ? tFlow("opening")
                    : compensationLabel && form.airline.trim()
                      ? t("letter.claimCta", {
                          airline: form.airline.trim(),
                          amount: compensationLabel,
                        })
                      : t("letter.claimCtaPlain")}
                </Button>
                <p className="text-caption text-ink-soft m-0 leading-snug text-center">
                  {t("letter.nextStep")}
                </p>
                <button
                  type="button"
                  disabled={!formComplete || busy}
                  className="mt-1 self-center bg-transparent border-0 p-0 text-caption text-ink-soft underline cursor-pointer disabled:opacity-45 disabled:cursor-default"
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
                </button>
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
              {/* "Generated in your browser only, nothing is sent or stored
                  with us" is true of the copy-a-letter path and false of the
                  button above it, which posts the whole form to open a case.
                  Printed under both, it was a privacy promise the primary
                  action breaks. It now appears only where it is true. */}
              {letter && (
                <p className="text-micro text-ink-soft mt-3 mb-0 leading-snug">
                  {t("letter.privacy")}
                </p>
              )}
              <p className="text-micro text-ink-soft mt-2 mb-0 leading-relaxed border border-[rgba(240,180,92,0.28)] bg-[rgba(240,180,92,0.06)] rounded-xl px-3 py-2.5">
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
