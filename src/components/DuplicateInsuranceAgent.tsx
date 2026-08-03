"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { hasOutreachEmail, redirectIfOpenLoop } from "@/lib/openLoopClient";
import { Card, Button, Input } from "@/components/ui";
import type { DuplicationResult } from "@/lib/insurance";
import { wastefulPolicyKeysFromResult } from "@/lib/duplicateInsuranceClaim";
import { formatAgorot } from "@/lib/money";

export function DuplicateInsuranceAgent({
  bcp47,
  duplication,
}: {
  bcp47: string;
  duplication: DuplicationResult | null;
}) {
  const t = useTranslations("dupInsuranceAgent");
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [insurerName, setInsurerName] = useState("");
  const [insurerEmail, setInsurerEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);

  const wastefulKeys = duplication ? wastefulPolicyKeysFromResult(duplication) : [];
  const monthlyAgorot = duplication?.wastefulMonthlyAgorot ?? 0;
  const canSend =
    wastefulKeys.length > 0 &&
    monthlyAgorot >= 100 &&
    insurerName.trim().length > 0 &&
    hasOutreachEmail(insurerEmail);

  async function sendWithAgent() {
    if (!canSend) return;
    setAgentError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/duplicate-insurance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          insurerName: insurerName.trim(),
          insurerEmail: insurerEmail.trim() || undefined,
          wastefulPolicyKeys: wastefulKeys,
          monthlyPremiumAgorot: monthlyAgorot,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=/duplicate-insurance`);
        return;
      }
      if (!res.ok) {
        if (redirectIfOpenLoop(data, router.push)) return;
        setAgentError(
          data.error === "needsOutreachEmail"
            ? t("emailQ")
            : data.error === "caseLimit"
              ? t("caseLimitError")
              : t("genericError"),
        );
        return;
      }
      setCaseId(data.caseId);
      router.push(
        data.dispatched ? `/money?case=${data.caseId}&sent=1` : `/money?case=${data.caseId}`,
      );
    } catch {
      setAgentError(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  if (!duplication || duplication.wastefulMonthlyAgorot <= 0) {
    return null;
  }

  if (caseId) {
    return (
      <div id="dup-insurance-agent" className="mt-10">
        <Card className="p-5 border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)]">
          <div className="text-emerald font-extrabold text-[15px]">{t("caseOpenedTitle")}</div>
          <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed mb-3">{t("caseOpenedBody")}</p>
          <Link href={`/money?case=${caseId}`}>
            <Button className="w-full">{t("dashboard")}</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div id="dup-insurance-agent" className="mt-10">
      <Card className="p-6 flex flex-col gap-4">
        <div className="font-display text-lg">{t("title")}</div>
        <p className="text-[13.5px] text-ink-soft leading-relaxed">{t("sub")}</p>
        <p className="text-[13px] text-ink">
          {t("estMonthly", { amount: formatAgorot(monthlyAgorot, bcp47) })}
        </p>

        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("nameQ")}</span>
          <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("insurerQ")}</span>
          <Input value={insurerName} onChange={(e) => setInsurerName(e.target.value)} required />
        </label>
        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("emailQ")}</span>
          <Input
            type="email"
            value={insurerEmail}
            onChange={(e) => setInsurerEmail(e.target.value)}
            required
          />
        </label>

        {agentError && <p className="text-[13px] text-[#f08a6b]">{agentError}</p>}

        <Button disabled={!canSend || busy} onClick={sendWithAgent}>
          {busy ? t("sending") : t("sendBtn")}
        </Button>
        <p className="text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
      </Card>
    </div>
  );
}
