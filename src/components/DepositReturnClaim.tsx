"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { hasOutreachEmail, redirectIfOpenLoop } from "@/lib/openLoopClient";
import { Card, Button, Input } from "@/components/ui";
import { MissingFields } from "@/components/MissingFields";
import { OutcomeReport } from "@/components/OutcomeReport";
import {
  assessDepositReturn,
  buildDepositDemandLetter,
  checkDepositCap,
  DEPOSIT_RETURN_DEADLINE_DAYS,
} from "@/lib/depositReturn";
import { formatAgorot, shekelsToAgorot } from "@/lib/money";
import { heEn } from "@/lib/heEn";
import { moneyCaseHref } from "@/lib/moneyCaseHref";

/**
 * Live deposit-return calculator + demand letter, alongside the static
 * educational content already on /deposit. Same dual-mode pattern as
 * late-payment/bank-fees: a self-help letter to copy, or "agent sends &
 * tracks" for a Mandate-backed Case (the tenant already vacated, so this
 * carries none of the ongoing-relationship risk overtime-backpay has).
 */
export function DepositReturnClaim({
  bcp47,
  mailLive = true,
}: {
  bcp47: string;
  /** False when no SMTP: the agent cannot deliver, so the letter leads. */
  mailLive?: boolean;
}) {
  const t = useTranslations("depositClaim");
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const router = useRouter();
  const [vacateDate, setVacateDate] = useState("");
  const [depositAmount, setDepositAmount] = useState(5000);
  const [monthlyRent, setMonthlyRent] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [landlordName, setLandlordName] = useState("");
  const [landlordEmail, setLandlordEmail] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [letter, setLetter] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);

  const status = useMemo(() => {
    if (!vacateDate) return null;
    return assessDepositReturn({ vacateDate });
  }, [vacateDate]);

  const capCheck = useMemo(() => {
    const rent = Number(monthlyRent);
    if (!rent || rent <= 0) return null;
    return checkDepositCap(shekelsToAgorot(depositAmount), shekelsToAgorot(rent));
  }, [depositAmount, monthlyRent]);

  const money = (a: number) => formatAgorot(a, bcp47);

  function generateLetter() {
    if (!status) return;
    setLetter(
      buildDepositDemandLetter({
        tenantName: tenantName.trim() || t("defaultTenant"),
        landlordName: landlordName.trim() || t("defaultLandlord"),
        propertyAddress: propertyAddress.trim() || "—",
        depositAmountAgorot: shekelsToAgorot(depositAmount),
        status,
      }),
    );
  }

  // Destination inbox required — express Mandate cannot dispatch without it.
  const canSendWithAgent =
    !!status?.isLate &&
    landlordName.trim().length > 0 &&
    propertyAddress.trim().length > 0 &&
    hasOutreachEmail(landlordEmail);

  async function sendWithAgent() {
    if (!canSendWithAgent) return;
    setAgentError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantName: tenantName.trim(),
          landlordName: landlordName.trim(),
          landlordEmail: landlordEmail.trim() || undefined,
          propertyAddress: propertyAddress.trim(),
          vacateDate,
          depositAmountShekels: depositAmount,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=/deposit`);
        return;
      }
      if (!res.ok) {
        if (redirectIfOpenLoop(data, router.push)) return;
        setAgentError(
          data.error === "needsOutreachEmail"
            ? t("landlordEmailQ")
            : data.error === "caseLimit"
              ? t("caseLimitError")
              : data.error === "notLateYet"
                ? t("notLateYetError")
                : t("genericError"),
        );
        return;
      }
      setCaseId(data.caseId);
      router.push(moneyCaseHref(data.caseId, { delivered: data.delivered }));
    } catch {
      setAgentError(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Card className="p-6 flex flex-col gap-4">
        <label className="block">
          <span className="text-body text-ink-soft block mb-1.5">{t("vacateDateQ")}</span>
          <Input type="date" value={vacateDate} onChange={(e) => setVacateDate(e.target.value)} />
        </label>

        <label className="block">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-body text-ink-soft">{t("amountQ")}</span>
            <span className="font-display text-[15px]">{money(shekelsToAgorot(depositAmount))}</span>
          </div>
          <input
            type="range"
            min={500}
            max={100000}
            step={100}
            value={depositAmount}
            onChange={(e) => setDepositAmount(Number(e.target.value))}
            aria-label={t("amountQ")}
          />
        </label>

        <label className="block">
          <span className="text-body text-ink-soft block mb-1.5">{t("rentQ")}</span>
          <Input
            type="number"
            min={0}
            value={monthlyRent}
            onChange={(e) => setMonthlyRent(e.target.value)}
            placeholder="₪"
          />
        </label>
      </Card>

      {status && (
        <Card className="mt-5 p-6 text-center">
          <div className="text-body text-ink-soft font-bold">
            {status.isLate ? t("statusLate") : t("statusNotYet")}
          </div>
          <div className="font-display grad-text text-4xl mt-1.5" aria-live="polite">
            {status.isLate
              ? t("daysLate", { count: status.daysLate })
              : status.dueDate.toLocaleDateString("he-IL")}
          </div>
          <p className="text-[12px] text-ink-soft mt-3 leading-relaxed">
            {t("deadlineNote", { days: DEPOSIT_RETURN_DEADLINE_DAYS })}
          </p>
        </Card>
      )}

      {capCheck?.exceeds && (
        <Card className="mt-5 p-5 border border-[rgba(240,180,92,0.35)] bg-[rgba(240,180,92,0.06)]">
          <p className="text-body leading-relaxed m-0">
            {t("capExceededNote", { cap: money(capCheck.capAgorot) })}
          </p>
        </Card>
      )}

      <Card className="mt-5 p-6 flex flex-col gap-3">
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          <label className="block">
            <span className="text-body text-ink-soft block mb-1.5">{t("tenantQ")}</span>
            <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-body text-ink-soft block mb-1.5">{t("landlordQ")}</span>
            <Input value={landlordName} onChange={(e) => setLandlordName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-body text-ink-soft block mb-1.5">{t("landlordEmailQ")}</span>
            <Input
              type="email"
              value={landlordEmail}
              onChange={(e) => setLandlordEmail(e.target.value)}
              placeholder="landlord@example.com"
            />
          </label>
          <label className="block">
            <span className="text-body text-ink-soft block mb-1.5">{t("addressQ")}</span>
            <Input value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} />
          </label>
        </div>
        <div className="flex flex-col gap-2">
          {/* Emphasis follows what can actually happen. With no outbound
              mail the agent cannot deliver, so the copy-only letter is not an
              "alternative" — it is the only route that reaches anyone. */}
          <Button
            variant={mailLive ? "primary" : "ghost"}
            onClick={sendWithAgent}
            disabled={!canSendWithAgent || busy}
          >
            {busy ? t("agentBusy") : t("agentSendCta")}
          </Button>
          <details className="text-body text-ink-soft">
            <summary className="cursor-pointer font-bold select-none">
              {heEn(he, "חלופה — מכתב להעתקה בלבד", "Alternative — copy-only letter")}
            </summary>
            <Button
              variant={mailLive ? "ghost" : "primary"}
              className="mt-2 w-full"
              onClick={generateLetter}
              disabled={!status}
            >
              {t("generateCta")}
            </Button>
          </details>
        </div>
        {!status?.isLate && (
          <p className="text-[12px] text-ink-soft">{t("agentNeedsLate")}</p>
        )}
        {/* Once the deposit is actually late, the only thing left between the
            tenant and a case is the fields — so name every one that is still
            missing, not just the email. */}
        {status?.isLate && (
          <MissingFields
            items={[
              { ok: landlordName.trim().length > 0, label: t("landlordQ") },
              { ok: propertyAddress.trim().length > 0, label: t("addressQ") },
              { ok: hasOutreachEmail(landlordEmail), label: t("landlordEmailQ") },
            ]}
          />
        )}
        {agentError && <p className="text-body text-amber">{agentError}</p>}
      </Card>

      {caseId && (
        <Card className="mt-5 p-5 border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)]">
          <div className="text-emerald font-extrabold text-[15px]">{t("caseOpenedTitle")}</div>
          <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed mb-3">{t("caseOpenedBody")}</p>
          <Link href={`/money?case=${caseId}`}>
            <Button className="w-full">{t("goToDashboard")}</Button>
          </Link>
        </Card>
      )}

      {letter && (
        <Card className="mt-5 p-6">
          <textarea
            readOnly
            value={letter}
            rows={14}
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
          <OutcomeReport vertical="deposit" counterparty="landlord" variantId="firm_statutory" />
        </Card>
      )}
    </div>
  );
}
