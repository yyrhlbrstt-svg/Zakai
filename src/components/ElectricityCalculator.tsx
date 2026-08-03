"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Card, Input, Button, FieldError, RadioChips } from "@/components/ui";
import { estimatePlans, type UsageProfile } from "@/lib/electricity";
import { formatAgorot, shekelsToAgorot, agorotToShekels } from "@/lib/money";
import { normalizeOutreachEmail } from "@/lib/outreachEmail";

const PROFILES: UsageProfile[] = ["spread", "day_home", "evening_family", "ev_night"];

const SUPPLIER_HE: Record<string, string> = {
  electra: "אלקטרה פאוור",
  cellcomEnergy: "סלקום אנרג'י",
  bezeqEnergy: "בזק אנרגיה",
  partnerPower: "פרטנר פאוור",
};

/**
 * Electricity plan comparison + optional full-service agent path.
 * Comparison is pure client-side. Opening a Case requires login and uses
 * the same Mandate loop as every other full vertical.
 */
export function ElectricityCalculator({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("electricity");
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const tIcomponents_ElectricityCalculator = useTranslations("inline_components_ElectricityCalculator");
  const tFlow = useTranslations("agentFlow");
  const router = useRouter();
  const [bill, setBill] = useState("400");
  const [profile, setProfile] = useState<UsageProfile>("spread");
  const [smartMeter, setSmartMeter] = useState(true);
  const [beneficiary, setBeneficiary] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);

  const billNum = parseFloat(bill);
  const results = useMemo(() => {
    if (!Number.isFinite(billNum) || billNum <= 0) return [];
    return estimatePlans(shekelsToAgorot(billNum), profile, smartMeter);
  }, [billNum, profile, smartMeter]);

  const money = (a: number) => formatAgorot(a, bcp47);

  async function openAgentCase(planId: string, providerKey: string, nameKey: string, savingAgorot: number) {
    setErr(null);
    // Soft-open: inbox optional — dashboard collects before Mandate dispatch.
    const email = normalizeOutreachEmail(supplierEmail) || undefined;
    setBusyId(planId);
    try {
      const res = await fetch("/api/cases/electricity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetSupplier: SUPPLIER_HE[providerKey] || providerKey,
          planName: nameKey,
          monthlyBillShekels: billNum,
          estimatedSavingShekels: agorotToShekels(savingAgorot),
          hasSmartMeter: smartMeter,
          beneficiaryLabel: beneficiary.trim() || undefined,
          customerName: beneficiary.trim() || undefined,
          supplierEmail: email,
        }),
      });
      if (res.status === 401) {
        router.replace("/login?return=/electricity");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "needsOutreachEmail") {
          setErr(tFlow("errorNeedsEmail"));
          return;
        }
        setErr(he ? "לא ניתן לפתוח תיק כרגע. נסו שוב או התחברו." : "Could not open case. Try again or log in.");
        return;
      }
      const data = await res.json();
      setOpened(data.caseId);
      router.push(data.dispatched ? `/money?case=${data.caseId}&sent=1` : `/money?case=${data.caseId}`);
      router.refresh();
    } catch {
      setErr(he ? "שגיאת רשת. נסו שוב." : "Network error. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <Card className="p-6">
        <label className="block max-w-[240px]">
          <span className="text-[13.5px] text-ink-soft">{t("billLabel")}</span>
          <Input
            type="number"
            inputMode="decimal"
            min={1}
            value={bill}
            onChange={(e) => setBill(e.target.value)}
            className="mt-1.5"
          />
        </label>

        <div className="mt-5">
          <span className="text-[13.5px] text-ink-soft block mb-2">{t("profileLabel")}</span>
          <RadioChips
            value={profile}
            onChange={setProfile}
            ariaLabel={t("profileLabel")}
            options={PROFILES.map((p) => ({ value: p, label: t(`profiles.${p}`) }))}
          />
        </div>

        <label className="flex gap-2.5 items-center mt-5 text-[13.5px] cursor-pointer">
          <input
            type="checkbox"
            checked={smartMeter}
            onChange={(e) => setSmartMeter(e.target.checked)}
            className="w-[18px] h-[18px]"
          />
          <span>{t("smartMeter")}</span>
        </label>
        {!smartMeter && (
          <p className="text-[12px] text-ink-soft mt-2 mb-0 leading-snug">{t("noMeterNote")}</p>
        )}

        <label className="block mt-5 max-w-[280px]">
          <span className="text-[13.5px] text-ink-soft">
            {tIcomponents_ElectricityCalculator("t_3e177a1f")}
          </span>
          <Input
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value.slice(0, 40))}
            placeholder={tIcomponents_ElectricityCalculator("t_56630d92")}
            className="mt-1.5"
            maxLength={40}
          />
        </label>
        <label className="block mt-5 max-w-[320px]">
          <span className="text-[13.5px] text-ink-soft">{tIcomponents_ElectricityCalculator("supplierEmail")}</span>
          <Input
            type="email"
            value={supplierEmail}
            onChange={(e) => setSupplierEmail(e.target.value)}
            className="mt-1.5"
            dir="ltr"
          />
        </label>
        <p className="text-[12px] text-ink-soft mt-2 mb-0 leading-snug">{tFlow("honestNote")}</p>
      </Card>

      {results.length > 0 && (
        <Card className="mt-5 py-1.5">
          {results.map((r, i) => (
            <div
              key={r.plan.id}
              className="flex items-center gap-3.5 px-5 py-4 flex-wrap"
              style={{
                borderBottom: i < results.length - 1 ? "1px solid rgba(255,255,255,0.09)" : "none",
              }}
            >
              {i === 0 && (
                <span className="text-[10.5px] font-extrabold text-[#06121A] grad-bg rounded-full px-2 py-0.5">
                  {t("best")}
                </span>
              )}
              <div className="flex-1 basis-[170px]">
                <div className="font-extrabold text-[15px]">
                  {t(`providers.${r.plan.providerKey}`)} — {t(`planNames.${r.plan.nameKey}`)}
                </div>
                <div className="text-[11.5px] text-ink-soft mt-0.5">
                  {t("effective", { pct: r.effectivePct })}
                </div>
              </div>
              <div className="text-end">
                <div className="font-display text-lg text-emerald">
                  {money(r.monthlySavingAgorot)}
                  <span className="text-ink-soft text-[12px] font-sans"> {t("perMonth")}</span>
                </div>
                <div className="text-[11.5px] text-ink-soft">
                  {t("perYear", { amount: money(r.yearlySavingAgorot) })}
                </div>
              </div>
              {r.monthlySavingAgorot > 0 && (
                <Button
                  className="!text-[12.5px] !py-2 !px-3"
                  disabled={busyId === r.plan.id}
                  onClick={() =>
                    openAgentCase(
                      r.plan.id,
                      r.plan.providerKey,
                      t(`planNames.${r.plan.nameKey}`),
                      r.monthlySavingAgorot,
                    )
                  }
                >
                  {busyId === r.plan.id ? tFlow("opening") : tFlow("openCase")}
                </Button>
              )}
            </div>
          ))}
        </Card>
      )}

      {err && <FieldError>{err}</FieldError>}
      {opened && (
        <p className="mt-3 text-[13px] text-emerald font-bold">
          {tIcomponents_ElectricityCalculator("t_62d5403d")}
        </p>
      )}

      <p className="mt-5 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
      <p className="mt-2 text-[12px] text-ink-soft leading-relaxed">
        {tIcomponents_ElectricityCalculator("t_b1112228")}
      </p>
    </div>
  );
}
