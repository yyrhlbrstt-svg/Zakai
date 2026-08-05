"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { hasOutreachEmail, redirectIfOpenLoop } from "@/lib/openLoopClient";
import { Card, Input, Button, Textarea, RadioChips } from "@/components/ui";
import { moneyCaseHref } from "@/lib/moneyCaseHref";

export function BaggageClaimAgent() {
  const t = useTranslations("baggage");
  const tFlow = useTranslations("agentFlow");
  const router = useRouter();
  const [name, setName] = useState("");
  const [airline, setAirline] = useState("");
  const [airlineEmail, setAirlineEmail] = useState("");
  const [pirNumber, setPirNumber] = useState("");
  const [flightDate, setFlightDate] = useState("");
  const [disruptionType, setDisruptionType] = useState<"delayed" | "lost">("delayed");
  const [purchases, setPurchases] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = Boolean(airline.trim() && pirNumber.trim() && flightDate.trim());

  async function sendWithAgent() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/baggage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          airline,
          airlineContactEmail: hasOutreachEmail(airlineEmail) ? airlineEmail.trim() : undefined,
          pirNumber,
          flightDate,
          disruptionType,
          essentialPurchasesShekels: purchases ? Number(purchases) : undefined,
          description: description || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=/baggage`);
        return;
      }
      if (!res.ok) {
        if (redirectIfOpenLoop(data, router.push)) return;
        if (data.error === "needsOutreachEmail") {
          setError(t("agent.needsEmail"));
          return;
        }
        setError(
          data.error === "caseLimit" ? tFlow("errorCaseLimit") : tFlow("errorGeneric"),
        );
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
          <span className="text-[13px] text-ink-soft block mb-2">{t("agent.disruptionQ")}</span>
          <RadioChips
            value={disruptionType}
            onChange={setDisruptionType}
            ariaLabel={t("agent.disruptionQ")}
            options={[
              { value: "delayed", label: t("agent.delayed") },
              { value: "lost", label: t("agent.lost") },
            ]}
          />
        </div>
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.name")}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.airline")}</span>
            <Input value={airline} onChange={(e) => setAirline(e.target.value)} maxLength={80} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.airlineEmail")}</span>
            <Input
              type="email"
              value={airlineEmail}
              onChange={(e) => setAirlineEmail(e.target.value)}
              maxLength={120}
              dir="ltr"
            />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.pir")}</span>
            <Input value={pirNumber} onChange={(e) => setPirNumber(e.target.value)} maxLength={40} dir="ltr" />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.flightDate")}</span>
            <Input value={flightDate} onChange={(e) => setFlightDate(e.target.value)} maxLength={40} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.purchases")}</span>
            <Input type="number" value={purchases} onChange={(e) => setPurchases(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("agent.description")}</span>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </label>
        <p className="text-[12px] text-ink-soft leading-relaxed mb-0">{tFlow("honestNote")}</p>
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
