"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { Card, Button, Input } from "@/components/ui";
import { ARNONA_AGENT_RIGHTS } from "@/lib/arnonaAppeal";

export function ArnonaAgent() {
  const t = useTranslations("arnonaAgent");
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [municipalityName, setMunicipalityName] = useState("");
  const [municipalityEmail, setMunicipalityEmail] = useState("");
  const [rightId, setRightId] = useState<string>(ARNONA_AGENT_RIGHTS[0]);
  const [propertyAddress, setPropertyAddress] = useState("");
  const [payerNumber, setPayerNumber] = useState("");
  const [details, setDetails] = useState("");
  const [monthlyArnona, setMonthlyArnona] = useState(450);
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);

  const canSend =
    municipalityName.trim().length > 0 &&
    monthlyArnona > 0 &&
    municipalityEmail.trim().includes("@");

  async function sendWithAgent() {
    if (!canSend) return;
    setAgentError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/arnona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerId: customerId.trim(),
          municipalityName: municipalityName.trim(),
          municipalityEmail: municipalityEmail.trim(),
          rightId,
          propertyAddress: propertyAddress.trim(),
          payerNumber: payerNumber.trim(),
          details: details.trim(),
          monthlyArnonaShekels: monthlyArnona,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=/arnona`);
        return;
      }
      if (!res.ok) {
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

  if (caseId) {
    return (
      <Card className="mt-10 p-5 border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)]">
        <div className="text-emerald font-extrabold text-[15px]">{t("caseOpenedTitle")}</div>
        <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed mb-3">{t("caseOpenedBody")}</p>
        <Link href="/money">
          <Button className="w-full">{t("dashboard")}</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div id="arnona-agent" className="mt-12">
      <h2 className="font-display text-2xl mb-3">{t("title")}</h2>
      <p className="text-ink-soft text-[14px] mb-5 leading-relaxed">{t("sub")}</p>
      <Card className="p-6 flex flex-col gap-4">
        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("claimType")}</span>
          <select
            className="w-full rounded-xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.05)] px-4 py-2.5 text-[14px] text-ink"
            value={rightId}
            onChange={(e) => setRightId(e.target.value)}
          >
            {ARNONA_AGENT_RIGHTS.map((id) => (
              <option key={id} value={id}>
                {t(`rights.${id}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("monthlyQ")}</span>
          <Input
            type="number"
            min={1}
            value={monthlyArnona}
            onChange={(e) => setMonthlyArnona(Number(e.target.value))}
          />
        </label>

        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("municipalityQ")}</span>
          <Input value={municipalityName} onChange={(e) => setMunicipalityName(e.target.value)} required />
        </label>
        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("emailQ")}</span>
          <Input
            type="email"
            value={municipalityEmail}
            onChange={(e) => setMunicipalityEmail(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("nameQ")}</span>
          <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("idQ")}</span>
          <Input value={customerId} onChange={(e) => setCustomerId(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("addressQ")}</span>
          <Input value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("detailsQ")}</span>
          <Input value={details} onChange={(e) => setDetails(e.target.value)} />
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
