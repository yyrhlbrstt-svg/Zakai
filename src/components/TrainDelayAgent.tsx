"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { hasOutreachEmail, redirectIfOpenLoop } from "@/lib/openLoopClient";
import { Card, Input, Button, Textarea } from "@/components/ui";
import { MissingFields } from "@/components/MissingFields";
import { moneyCaseHref } from "@/lib/moneyCaseHref";

export function TrainDelayAgent() {
  const t = useTranslations("trainDelay");
  const tFlow = useTranslations("agentFlow");
  const router = useRouter();
  const [name, setName] = useState("");
  const [line, setLine] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [delayMinutes, setDelayMinutes] = useState("");
  const [ticketPrice, setTicketPrice] = useState("");
  const [claimedAmount, setClaimedAmount] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = Boolean(travelDate.trim() && hasOutreachEmail(contactEmail));

  async function sendWithAgent() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/train-delay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          trainLine: line,
          contactEmail: contactEmail.trim(),
          travelDate,
          delayMinutes: delayMinutes ? Number(delayMinutes) : undefined,
          ticketPriceShekels: ticketPrice ? Number(ticketPrice) : undefined,
          claimedAmountShekels: claimedAmount ? Number(claimedAmount) : undefined,
          description: description || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=/train-delay`);
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
            <span className="text-body text-ink-soft block mb-1.5">{t("agent.name")}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </label>
          <label className="block">
            <span className="text-body text-ink-soft block mb-1.5">{t("agent.line")}</span>
            <Input value={line} onChange={(e) => setLine(e.target.value)} maxLength={120} />
          </label>
          <label className="block">
            <span className="text-body text-ink-soft block mb-1.5">{t("agent.contactEmail")}</span>
            <Input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              maxLength={120}
              dir="ltr"
            />
          </label>
          <label className="block">
            <span className="text-body text-ink-soft block mb-1.5">{t("agent.travelDate")}</span>
            <Input value={travelDate} onChange={(e) => setTravelDate(e.target.value)} maxLength={40} />
          </label>
          <label className="block">
            <span className="text-body text-ink-soft block mb-1.5">{t("agent.delayMinutes")}</span>
            <Input type="number" value={delayMinutes} onChange={(e) => setDelayMinutes(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-body text-ink-soft block mb-1.5">{t("agent.ticketPrice")}</span>
            <Input type="number" value={ticketPrice} onChange={(e) => setTicketPrice(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-body text-ink-soft block mb-1.5">{t("agent.claimedAmount")}</span>
            <Input type="number" value={claimedAmount} onChange={(e) => setClaimedAmount(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="text-body text-ink-soft block mb-1.5">{t("agent.description")}</span>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </label>
        <MissingFields
          items={[
            { ok: Boolean(travelDate.trim()), label: t("agent.travelDate") },
            { ok: hasOutreachEmail(contactEmail), label: tFlow("contactEmail") },
          ]}
        />
        <Button onClick={sendWithAgent} disabled={!ready || busy}>
          {busy ? tFlow("opening") : tFlow("openCase")}
        </Button>
        {error && <p className="text-body text-amber m-0">{error}</p>}
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
