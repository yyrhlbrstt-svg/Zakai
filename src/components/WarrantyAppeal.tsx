"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { Card, Input, Button, Textarea } from "@/components/ui";
import { normalizeOutreachEmail } from "@/lib/outreachEmail";

export function WarrantyAppeal() {
  const t = useTranslations("warranty");
  const router = useRouter();
  const [name, setName] = useState("");
  const [seller, setSeller] = useState("");
  const [sellerEmail, setSellerEmail] = useState("");
  const [product, setProduct] = useState("");
  const [fault, setFault] = useState("");
  const [repairCost, setRepairCost] = useState("");
  const [letter, setLetter] = useState("");
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setLetter(t("template"));
  }

  async function sendWithAgent() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/warranty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          seller,
          sellerEmail: sellerEmail.trim(),
          product,
          fault,
          repairCostShekels: repairCost ? Number(repairCost) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=/warranty`);
        return;
      }
      if (!res.ok) {
        if (data.error === "needsOutreachEmail") {
          setError(t("agentNeedsEmail"));
          return;
        }
        setError(
          data.error === "caseLimit"
            ? t("agentCaseLimit")
            : t("agentError"),
        );
        return;
      }
      setLetter(data.body || "");
      setCaseId(data.caseId);
      router.push(`/dashboard?case=${data.caseId}`);
    } catch {
      setError(t("agentError"));
    } finally {
      setBusy(false);
    }
  }

  const ready =
    seller.trim() &&
    product.trim() &&
    fault.trim().length >= 3 &&
    normalizeOutreachEmail(sellerEmail) !== null;

  return (
    <div className="mt-8">
      <h2 className="font-display text-2xl mb-2">{t("agentTitle")}</h2>
      <p className="text-ink-soft text-[14px] mb-5 leading-relaxed">{t("agentSub")}</p>
      <Card className="p-6 flex flex-col gap-4">
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agentName")}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agentSeller")}</span>
            <Input value={seller} onChange={(e) => setSeller(e.target.value)} maxLength={80} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agentSellerEmail")}</span>
            <Input
              type="email"
              value={sellerEmail}
              onChange={(e) => setSellerEmail(e.target.value)}
              maxLength={120}
              dir="ltr"
            />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agentProduct")}</span>
            <Input value={product} onChange={(e) => setProduct(e.target.value)} maxLength={120} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("agentRepairCost")}</span>
            <Input type="number" value={repairCost} onChange={(e) => setRepairCost(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("agentFault")}</span>
          <Textarea rows={4} value={fault} onChange={(e) => setFault(e.target.value)} maxLength={500} />
        </label>
        <div className="flex flex-col gap-2">
          <Button onClick={sendWithAgent} disabled={!ready || busy}>
            {busy ? t("agentBusy") : t("agentCta")}
          </Button>
          <Button variant="ghost" onClick={generate} disabled={busy}>
            {t("templateOnly")}
          </Button>
        </div>
        {error && <p className="text-[13px] text-amber m-0">{error}</p>}
      </Card>

      {caseId && (
        <Card className="mt-5 p-5 border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)]">
          <div className="text-emerald font-extrabold text-[15px]">{t("agentOpenedTitle")}</div>
          <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed mb-3">{t("agentOpenedSub")}</p>
          <Link href={`/dashboard?case=${caseId}`}>
            <Button className="w-full">{t("agentDashboard")}</Button>
          </Link>
        </Card>
      )}

      {letter && !caseId && (
        <Card className="mt-5 p-6">
          <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-ink m-0">{letter}</pre>
        </Card>
      )}
    </div>
  );
}
