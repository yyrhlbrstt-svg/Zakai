"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { hasOutreachEmail, redirectIfOpenLoop } from "@/lib/openLoopClient";
import { Card, Input, Button, RadioChips } from "@/components/ui";
import { MissingFields } from "@/components/MissingFields";
import { OutcomeReport } from "@/components/OutcomeReport";
import { VerticalOutcomeStat } from "@/components/VerticalOutcomeStat";
import type { VerticalOutcomeStat as Stat } from "@/lib/strategy/insights";
import { heEn } from "@/lib/heEn";
import { moneyCaseHref } from "@/lib/moneyCaseHref";

interface ReasonOption {
  value: string;
  label: string;
  body: string;
}

/**
 * Shared shape behind every "reference number + counterparty + reason chips
 * + optional inbox lookup" appeal — first extracted from ParkingAppeal and
 * TransportFineAppeal, which were near-identical copies down to the JSX.
 * A new vertical of this shape is a config object, not a new 250-line file;
 * see docs/PIPE.md / the vertical rule packs for the rest of that pattern.
 */
export interface ReasonBasedAppealConfig {
  t: (key: string) => string;
  tFlow: (key: string) => string;

  referenceFieldLabel: string;
  counterpartyFieldLabel: string;
  amountFieldLabel: string;
  counterpartyEmailFieldLabel: string;
  copyOnlyButtonLabel: string;
  caseOpenedTitle: string;
  caseOpenedSub: string;
  dashboardButtonLabel: string;

  reasons: readonly ReasonOption[];
  defaultReason: string;

  apiEndpoint: string;
  loginReturnPath: string;

  /** Known-inbox auto-resolution (e.g. transport operators) — omit if none. */
  resolveKnownInbox?: (counterpartyName: string) => string | undefined;

  buildRequestBody: (fields: {
    customerName: string;
    referenceNumber: string;
    counterpartyName: string;
    reason: string;
    details: string | undefined;
    amountShekels: number | undefined;
    counterpartyEmail: string;
  }) => Record<string, unknown>;

  composeLetter: (fields: {
    customerName: string;
    referenceNumber: string;
    counterpartyName: string;
    reasonText: string;
    details: string;
  }) => string;

  outcomeVertical: string;
  outcomeCounterparty: string;
  outcomeVariantId?: string;
}

export function ReasonBasedAppealForm({
  config,
  stat,
  bcp47,
}: {
  config: ReasonBasedAppealConfig;
  stat?: Stat | null;
  bcp47?: string;
}) {
  const { t, tFlow } = config;
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const router = useRouter();
  const [name, setName] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [counterpartyEmail, setCounterpartyEmail] = useState("");
  const [reason, setReason] = useState(config.defaultReason);
  const [details, setDetails] = useState("");
  const [amount, setAmount] = useState("");
  const [letter, setLetter] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const knownInbox = config.resolveKnownInbox?.(counterpartyName);
  const agentReady =
    referenceNumber.trim().length > 0 &&
    counterpartyName.trim().length > 0 &&
    (Boolean(knownInbox) || hasOutreachEmail(counterpartyEmail));

  function generate() {
    const reasonText = config.reasons.find((r) => r.value === reason)?.body ?? "";
    setLetter(
      config.composeLetter({
        customerName: name,
        referenceNumber,
        counterpartyName,
        reasonText,
        details,
      }),
    );
  }

  async function sendWithAgent() {
    setError(null);
    if (!knownInbox && !hasOutreachEmail(counterpartyEmail)) {
      setError(tFlow("errorNeedsEmail"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(config.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          config.buildRequestBody({
            customerName: name,
            referenceNumber,
            counterpartyName,
            reason,
            details: details || undefined,
            amountShekels: amount ? Number(amount) : undefined,
            counterpartyEmail: counterpartyEmail.trim(),
          }),
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=${config.loginReturnPath}`);
        return;
      }
      if (!res.ok) {
        if (redirectIfOpenLoop(data, router.push)) return;
        if (data.error === "needsOutreachEmail") {
          setError(tFlow("errorNeedsEmail"));
          return;
        }
        setError(data.error === "caseLimit" ? tFlow("errorCaseLimit") : tFlow("errorGeneric"));
        return;
      }
      setLetter(data.body || "");
      setCaseId(data.caseId);
      router.push(moneyCaseHref(data.caseId, { delivered: data.delivered }));
    } catch {
      setError(tFlow("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {stat && bcp47 && <VerticalOutcomeStat stat={stat} bcp47={bcp47} />}
      <Card className="p-6 flex flex-col gap-4">
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          <label className="block">
            <span className="text-body text-ink-soft block mb-1.5">{t("name")}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </label>
          <label className="block">
            <span className="text-body text-ink-soft block mb-1.5">{config.referenceFieldLabel}</span>
            <Input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              maxLength={40}
              dir="ltr"
            />
          </label>
          <label className="block">
            <span className="text-body text-ink-soft block mb-1.5">{config.counterpartyFieldLabel}</span>
            <Input value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} maxLength={40} />
          </label>
          <label className="block">
            <span className="text-body text-ink-soft block mb-1.5">{config.amountFieldLabel}</span>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
        </div>

        <div>
          <span className="text-body text-ink-soft block mb-2">{t("reasonQ")}</span>
          <RadioChips
            value={reason}
            onChange={setReason}
            ariaLabel={t("reasonQ")}
            options={config.reasons.map((r) => ({ value: r.value, label: r.label }))}
          />
        </div>

        <label className="block">
          <span className="text-body text-ink-soft block mb-1.5">{t("details")}</span>
          <Input value={details} onChange={(e) => setDetails(e.target.value)} maxLength={300} />
        </label>

        <label className="block">
          <span className="text-body text-ink-soft block mb-1.5">{config.counterpartyEmailFieldLabel}</span>
          <Input
            type="email"
            value={counterpartyEmail}
            onChange={(e) => setCounterpartyEmail(e.target.value)}
            maxLength={120}
            dir="ltr"
          />
        </label>

        <p className="text-[12px] text-ink-soft leading-relaxed mb-0">{tFlow("honestNote")}</p>

        <div className="flex flex-col gap-2">
          <MissingFields
            items={[
              { ok: Boolean(referenceNumber.trim()), label: config.referenceFieldLabel },
              { ok: Boolean(counterpartyName.trim()), label: config.counterpartyFieldLabel },
              {
                ok: Boolean(knownInbox) || hasOutreachEmail(counterpartyEmail),
                label: config.counterpartyEmailFieldLabel,
              },
            ]}
          />
          <Button onClick={sendWithAgent} disabled={!agentReady || busy}>
            {busy ? tFlow("opening") : tFlow("openCase")}
          </Button>
          <details className="text-body text-ink-soft">
            <summary className="cursor-pointer font-bold select-none">
              {heEn(he, "חלופה — מכתב להעתקה בלבד", "Alternative — copy-only letter")}
            </summary>
            <Button
              variant="ghost"
              className="mt-2 w-full"
              onClick={generate}
              disabled={!referenceNumber.trim() || !counterpartyName.trim() || busy}
            >
              {config.copyOnlyButtonLabel}
            </Button>
          </details>
        </div>
        {error && <p className="text-body text-amber m-0">{error}</p>}
      </Card>

      {caseId && (
        <Card className="mt-5 p-5 border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)]">
          <div className="text-emerald font-extrabold text-[15px]">{config.caseOpenedTitle}</div>
          <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed mb-3">{config.caseOpenedSub}</p>
          <Link href={`/money?case=${caseId}`}>
            <Button className="w-full">{config.dashboardButtonLabel}</Button>
          </Link>
        </Card>
      )}

      {letter && (
        <Card className="mt-5 p-6">
          <textarea
            readOnly
            value={letter}
            rows={16}
            dir="rtl"
            className="w-full px-4 py-3 rounded-xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.05)] text-body leading-relaxed text-ink box-border"
          />
          <div className="flex gap-3 mt-3 flex-wrap items-center">
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(letter);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* selectable */
                }
              }}
            >
              {copied ? t("copied") : t("copy")}
            </Button>
            <span className="text-[12px] text-ink-soft">{t("sendHint")}</span>
          </div>
          <OutcomeReport
            vertical={config.outcomeVertical}
            counterparty={config.outcomeCounterparty}
            variantId={config.outcomeVariantId ?? "firm_statutory"}
          />
          <p className="text-[11.5px] text-ink-soft mt-3 mb-0 leading-relaxed border border-[rgba(240,180,92,0.28)] bg-[rgba(240,180,92,0.06)] rounded-xl px-3 py-2.5">
            {t("legal")}
          </p>
        </Card>
      )}

      <p className="mt-5 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}
