"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { Card, Button, Input } from "@/components/ui";
import { buildRefundLetter } from "@/lib/refundChase";
import { withFooter } from "@/lib/letterFooter";

export function RefundChaseTool() {
  const locale = useLocale();
  const footerLocale = locale === "he" || locale === "ar" ? "he" : "en";
  const t = useTranslations("inline_components_RefundChaseTool");
  const tFlow = useTranslations("agentFlow");
  const router = useRouter();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [orderId, setOrderId] = useState("");
  const [product, setProduct] = useState("");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("14");
  const [out, setOut] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Soft-open: inbox optional — dashboard collects before dispatch.
  const agentReady = company.trim().length > 0;

  async function sendWithAgent() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          company,
          contactEmail: contactEmail.trim(),
          orderId: orderId || undefined,
          product: product || undefined,
          amountShekels: amount ? Number(amount) : undefined,
          daysWaiting: Number(days) || 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=/refund-chase`);
        return;
      }
      if (!res.ok) {
        if (data.error === "needsOutreachEmail") {
          setError(tFlow("errorNeedsEmail"));
          return;
        }
        setError(
          res.status === 403 && data.error === "caseLimit"
            ? tFlow("errorCaseLimit")
            : tFlow("errorGeneric"),
        );
        return;
      }
      const letter = buildRefundLetter({
        customerName: name,
        company,
        orderId,
        product,
        amountShekels: amount ? Number(amount) : undefined,
        daysWaiting: Number(days) || 0,
      });
      setOut({
        subject: letter.subject,
        body: withFooter(letter.body, footerLocale),
      });
      setCaseId(data.caseId);
      router.push(`/dashboard?case=${data.caseId}`);
    } catch {
      setError(tFlow("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5 flex flex-col gap-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("t_ebd6b437")} />
        <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t("t_6a05400b")} />
        <Input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder={t("contactEmailPlaceholder")}
        />
        <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder={t("t_8ef9df6f")} />
        <Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder={t("t_1b118af5")} />
        <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t("t_824751e8")} />
        <Input type="number" value={days} onChange={(e) => setDays(e.target.value)} placeholder={t("t_d6fd4e06")} />

        <p className="text-[12px] text-ink-soft leading-relaxed mb-0">{tFlow("honestNote")}</p>

        <div className="flex flex-col gap-2 mt-1">
          <Button onClick={sendWithAgent} disabled={!agentReady || busy} className="w-full">
            {busy ? tFlow("opening") : tFlow("openCase")}
          </Button>
          <Button
            variant="ghost"
            className="w-full text-[13px]"
            disabled={!company.trim() || busy}
            onClick={() => {
              const letter = buildRefundLetter({
                customerName: name,
                company,
                orderId,
                product,
                amountShekels: amount ? Number(amount) : undefined,
                daysWaiting: Number(days) || 0,
              });
              setOut({
                subject: letter.subject,
                body: withFooter(letter.body, footerLocale),
              });
            }}
          >
            {t("t_b4c9b341")}
          </Button>
        </div>
        {error && <p className="text-[13px] text-amber mt-1 mb-0">{error}</p>}
      </Card>

      {caseId && (
        <Card className="p-5 border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)]">
          <div className="text-emerald font-extrabold text-[15px]">{t("t_360e126e")}</div>
          <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed mb-3">{t("t_f9f3c72c")}</p>
          <Link href={`/dashboard?case=${caseId}`}>
            <Button className="w-full">{t("t_8ae29d51")}</Button>
          </Link>
        </Card>
      )}

      {out && (
        <Card className="p-5">
          <div className="font-extrabold">{out.subject}</div>
          <pre className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed bg-[#060b12] rounded-xl p-4 border border-[rgba(255,255,255,0.08)]">
            {out.body}
          </pre>
          <Button
            className="mt-3"
            variant="ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${out.subject}\n\n${out.body}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                /* ignore */
              }
            }}
          >
            {copied ? tFlow("copied") : tFlow("copyAll")}
          </Button>
        </Card>
      )}
    </div>
  );
}
