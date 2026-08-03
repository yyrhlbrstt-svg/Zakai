"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { Card, Button, Input } from "@/components/ui";
import { buildCarInsuranceRefundLetter } from "@/lib/carInsuranceRefund";
import { withFooter } from "@/lib/letterFooter";
import { resolveInsuranceContactEmail } from "@/lib/utilityContacts";
import { heEn } from "@/lib/heEn";

export function CarInsuranceRefundTool() {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const footerLocale = he ? "he" : "en";
  const tFlow = useTranslations("agentFlow");
  const router = useRouter();
  const [name, setName] = useState("");
  const [insurer, setInsurer] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [reason, setReason] = useState("");
  const [premium, setPremium] = useState("");
  const [unusedMonths, setUnusedMonths] = useState("");
  const [out, setOut] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const knownInbox = resolveInsuranceContactEmail(insurer);
  // Soft-open: inbox optional — dashboard collects before dispatch.
  const agentReady = insurer.trim().length > 0;

  function letterInput() {
    return {
      customerName: name,
      insurer,
      policyNumber: policyNumber || undefined,
      vehicle: vehicle || undefined,
      cancelReason: reason || undefined,
      premiumPaidShekels: premium ? Number(premium) : undefined,
      unusedMonths: unusedMonths ? Number(unusedMonths) : undefined,
    };
  }

  async function sendWithAgent() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/car-insurance-refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...letterInput(),
          contactEmail: contactEmail.trim() || knownInbox || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=/car-insurance-refund`);
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
      const letter = buildCarInsuranceRefundLetter(letterInput());
      setOut({ subject: letter.subject, body: withFooter(letter.body, footerLocale) });
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
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={heEn(he, "שם מלא", "Full name")}
        />
        <Input
          value={insurer}
          onChange={(e) => setInsurer(e.target.value)}
          placeholder={heEn(he, "שם המבטח (הפניקס / הראל / …)", "Insurer name")}
        />
        <Input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder={
            knownInbox
              ? he
                ? `אימייל שירות (ברירת מחדל: ${knownInbox})`
                : `Support email (default: ${knownInbox})`
              : he
                ? "אימייל שירות של המבטח"
                : "Insurer support email"
          }
          dir="ltr"
        />
        <Input
          value={policyNumber}
          onChange={(e) => setPolicyNumber(e.target.value)}
          placeholder={heEn(he, "מספר פוליסה", "Policy number")}
        />
        <Input
          value={vehicle}
          onChange={(e) => setVehicle(e.target.value)}
          placeholder={heEn(he, "רכב (מספר / דגם)", "Vehicle (plate / model)")}
        />
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={heEn(he, "סיבת ביטול (מכירה / מעבר מבטח…)", "Cancel reason")}
        />
        <Input
          type="number"
          value={premium}
          onChange={(e) => setPremium(e.target.value)}
          placeholder={heEn(he, "פרמיה ששולמה ₪ (אופציונלי)", "Premium paid ₪ (optional)")}
        />
        <Input
          type="number"
          value={unusedMonths}
          onChange={(e) => setUnusedMonths(e.target.value)}
          placeholder={heEn(he, "חודשים שלא נוצלו (אופציונלי)", "Unused months (optional)")}
        />

        <p className="text-[12px] text-ink-soft leading-relaxed mb-0">{tFlow("honestNote")}</p>

        <div className="flex flex-col gap-2 mt-1">
          <Button onClick={sendWithAgent} disabled={!agentReady || busy} className="w-full">
            {busy ? tFlow("opening") : tFlow("openCase")}
          </Button>
          <Button
            variant="ghost"
            className="w-full text-[13px]"
            disabled={!insurer.trim() || busy}
            onClick={() => {
              const letter = buildCarInsuranceRefundLetter(letterInput());
              setOut({
                subject: letter.subject,
                body: withFooter(letter.body, footerLocale),
              });
            }}
          >
            {heEn(he, "רק טיוטה להעתקה", "Draft only (copy)")}
          </Button>
        </div>
        {error && <p className="text-[13px] text-amber mt-1 mb-0">{error}</p>}
      </Card>

      {caseId && (
        <Card className="p-5 border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)]">
          <div className="text-emerald font-extrabold text-[15px]">
            {heEn(he, "תיק נפתח", "Case opened")}
          </div>
          <Link href={`/dashboard?case=${caseId}`}>
            <Button className="w-full mt-3">{heEn(he, "לדשבורד", "Dashboard")}</Button>
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
            variant="ghost"
            className="mt-3"
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
            {copied ? (he ? "הועתק" : "Copied") : he ? "העתק" : "Copy"}
          </Button>
        </Card>
      )}
    </div>
  );
}
