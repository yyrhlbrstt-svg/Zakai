"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { hasOutreachEmail, redirectIfOpenLoop } from "@/lib/openLoopClient";
import { Card, Input, Button, Textarea } from "@/components/ui";
import { moneyCaseHref } from "@/lib/moneyCaseHref";

export function LandlordRepairAgent() {
  const t = useTranslations("landlordRepairs");
  const tFlow = useTranslations("agentFlow");
  const router = useRouter();
  const [name, setName] = useState("");
  const [landlordName, setLandlordName] = useState("");
  const [landlordEmail, setLandlordEmail] = useState("");
  const [address, setAddress] = useState("");
  const [defect, setDefect] = useState("");
  const [days, setDays] = useState("");
  const [repairCost, setRepairCost] = useState("");
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = Boolean(landlordName.trim() && address.trim() && defect.trim().length >= 3);

  async function sendWithAgent() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/landlord-repairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantName: name,
          landlordName,
          landlordEmail: hasOutreachEmail(landlordEmail) ? landlordEmail.trim() : undefined,
          propertyAddress: address,
          defectDescription: defect,
          daysSinceReported: days ? Number(days) : undefined,
          estimatedRepairCostShekels: repairCost ? Number(repairCost) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=/landlord-repairs`);
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
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.name")}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.landlordName")}</span>
            <Input value={landlordName} onChange={(e) => setLandlordName(e.target.value)} maxLength={80} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.landlordEmail")}</span>
            <Input
              type="email"
              value={landlordEmail}
              onChange={(e) => setLandlordEmail(e.target.value)}
              maxLength={120}
              dir="ltr"
            />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.address")}</span>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={120} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.daysSinceReported")}</span>
            <Input type="number" value={days} onChange={(e) => setDays(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.repairCost")}</span>
            <Input type="number" value={repairCost} onChange={(e) => setRepairCost(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.defect")}</span>
          <Textarea rows={4} value={defect} onChange={(e) => setDefect(e.target.value)} maxLength={500} />
        </label>
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
