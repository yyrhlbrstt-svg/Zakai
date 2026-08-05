"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { hasOutreachEmail, redirectIfOpenLoop } from "@/lib/openLoopClient";
import { Card, Input, Button, RadioChips } from "@/components/ui";
import { moneyCaseHref } from "@/lib/moneyCaseHref";

export function WaterBillAgent() {
  const t = useTranslations("waterBill");
  const tFlow = useTranslations("agentFlow");
  const router = useRouter();
  const [name, setName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [repairDate, setRepairDate] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [hasRepairProof, setHasRepairProof] = useState<"yes" | "no">("no");
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = Boolean(repairDate.trim() && hasOutreachEmail(contactEmail));

  async function sendWithAgent() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/water-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          accountNumber,
          contactEmail: contactEmail.trim(),
          repairDate,
          billAmountShekels: billAmount ? Number(billAmount) : undefined,
          hasRepairProof: hasRepairProof === "yes",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=/water-bill`);
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
        <div>
          <span className="text-[13px] text-ink-soft block mb-2">{t("agent.proofQ")}</span>
          <RadioChips
            value={hasRepairProof}
            onChange={setHasRepairProof}
            ariaLabel={t("agent.proofQ")}
            options={[
              { value: "yes", label: t("agent.proofYes") },
              { value: "no", label: t("agent.proofNo") },
            ]}
          />
        </div>
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.name")}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.accountNumber")}</span>
            <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} maxLength={40} dir="ltr" />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.contactEmail")}</span>
            <Input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              maxLength={120}
              dir="ltr"
            />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.repairDate")}</span>
            <Input value={repairDate} onChange={(e) => setRepairDate(e.target.value)} maxLength={40} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.billAmount")}</span>
            <Input type="number" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} />
          </label>
        </div>
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
