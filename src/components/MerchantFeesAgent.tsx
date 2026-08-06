"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { hasOutreachEmail, redirectIfOpenLoop } from "@/lib/openLoopClient";
import { Card, Input, Button, Select, Textarea } from "@/components/ui";
import { MissingFields } from "@/components/MissingFields";
import { moneyCaseHref } from "@/lib/moneyCaseHref";
import type { MerchantFeeConcern } from "@/lib/merchantFeeLetter";

const CONCERNS: MerchantFeeConcern[] = [
  "rate_too_high",
  "terminal_rental",
  "monthly_minimum",
  "unexplained_charge",
  "other",
];

export function MerchantFeesAgent() {
  const t = useTranslations("merchantFees");
  const tFlow = useTranslations("agentFlow");
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [acquirer, setAcquirer] = useState("");
  const [merchantNumber, setMerchantNumber] = useState("");
  const [concern, setConcern] = useState<MerchantFeeConcern>("rate_too_high");
  const [currentTerms, setCurrentTerms] = useState("");
  const [turnover, setTurnover] = useState("");
  const [yearsAsCustomer, setYearsAsCustomer] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = Boolean(
    businessName.trim() && acquirer.trim() && hasOutreachEmail(contactEmail),
  );

  async function sendWithAgent() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/merchant-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          businessId: businessId.trim(),
          acquirer: acquirer.trim(),
          merchantNumber: merchantNumber.trim(),
          concern,
          currentTerms: currentTerms.trim(),
          monthlyTurnoverShekels: turnover ? Number(turnover) : undefined,
          yearsAsCustomer: yearsAsCustomer.trim(),
          contactEmail: contactEmail.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=/merchant-fees`);
        return;
      }
      if (!res.ok) {
        if (redirectIfOpenLoop(data, router.push)) return;
        if (data.error === "needsOutreachEmail") {
          setError(t("agent.needsEmail"));
          return;
        }
        setError(data.error === "caseLimit" ? tFlow("errorCaseLimit") : tFlow("errorGeneric"));
        return;
      }
      setCaseId(data.caseId);
      router.push(moneyCaseHref(data.caseId, { delivered: data.delivered }));
    } catch {
      setError(tFlow("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      <h2 className="font-display text-2xl mb-2">{t("agent.title")}</h2>
      <p className="text-ink-soft text-[14px] mb-5 leading-relaxed">{t("agent.sub")}</p>
      <Card className="p-6 flex flex-col gap-4">
        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.concern")}</span>
          <Select
            value={concern}
            onChange={(e) => setConcern(e.target.value as MerchantFeeConcern)}
            aria-label={t("agent.concern")}
          >
            {CONCERNS.map((c) => (
              <option key={c} value={c}>
                {t(`concerns.${c}`)}
              </option>
            ))}
          </Select>
        </label>

        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.businessName")}</span>
            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={120} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.businessId")}</span>
            <Input value={businessId} onChange={(e) => setBusinessId(e.target.value)} maxLength={20} dir="ltr" />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.acquirer")}</span>
            <Input value={acquirer} onChange={(e) => setAcquirer(e.target.value)} maxLength={80} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.merchantNumber")}</span>
            <Input value={merchantNumber} onChange={(e) => setMerchantNumber(e.target.value)} maxLength={40} dir="ltr" />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{tFlow("contactEmail")}</span>
            <Input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              maxLength={120}
              dir="ltr"
            />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.turnover")}</span>
            <Input type="number" value={turnover} onChange={(e) => setTurnover(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.years")}</span>
            <Input value={yearsAsCustomer} onChange={(e) => setYearsAsCustomer(e.target.value)} maxLength={40} />
          </label>
        </div>

        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.currentTerms")}</span>
          <Textarea
            rows={3}
            value={currentTerms}
            onChange={(e) => setCurrentTerms(e.target.value)}
            maxLength={300}
            placeholder={t("agent.currentTermsHint")}
          />
        </label>

        <p className="text-[12px] text-ink-soft leading-relaxed mb-0">{t("agent.honestNote")}</p>

        <MissingFields
          items={[
            { ok: Boolean(businessName.trim()), label: t("agent.businessName") },
            { ok: Boolean(acquirer.trim()), label: t("agent.acquirer") },
            { ok: hasOutreachEmail(contactEmail), label: tFlow("contactEmail") },
          ]}
        />
        <Button onClick={sendWithAgent} disabled={!ready || busy}>
          {busy ? tFlow("opening") : tFlow("openCase")}
        </Button>
        {error && <p className="text-[13px] text-amber m-0">{error}</p>}
      </Card>

      {caseId && (
        <Card className="mt-5 p-5 border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)]">
          <div className="text-emerald font-extrabold text-[15px]">{t("agent.openedTitle")}</div>
          <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed mb-3">{t("agent.openedSub")}</p>
          <Link href={`/money?case=${caseId}`}>
            <Button className="w-full">{t("agent.dashboard")}</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
