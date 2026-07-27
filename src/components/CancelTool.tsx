"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Card, Button, Input, Select, Textarea } from "@/components/ui";
import { buildCancelLetter, type CancelIntent } from "@/lib/cancelLetter";

export function CancelTool() {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [product, setProduct] = useState("");
  const [account, setAccount] = useState("");
  const [monthly, setMonthly] = useState("");
  const [intent, setIntent] = useState<CancelIntent>("cancel");
  const [reason, setReason] = useState("");
  const [out, setOut] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    setOut(
      buildCancelLetter({
        customerName: name,
        company,
        product,
        accountOrEmail: account,
        monthlyShekels: monthly ? Number(monthly) : undefined,
        intent,
        reason,
      }),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5 flex flex-col gap-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={he ? "השם שלך" : "Your name"} />
        <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={he ? "שם החברה (נטפליקס, חדר כושר…)" : "Company name"} />
        <Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder={he ? "מה המנוי / השירות" : "Product / plan"} />
        <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder={he ? "אימייל / מספר לקוח (אופציונלי)" : "Account / email (optional)"} />
        <Input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder={he ? "כמה משלמים בחודש ₪ (אופציונלי)" : "Monthly ₪ (optional)"} />
        <Select value={intent} onChange={(e) => setIntent(e.target.value as CancelIntent)}>
          <option value="cancel">{he ? "ביטול מלא" : "Cancel"}</option>
          <option value="retention">{he ? "בקשת הנחה / שימור" : "Ask for discount"}</option>
          <option value="downgrade">{he ? "הורדת מסלול" : "Downgrade"}</option>
          <option value="pause">{he ? "הקפאה" : "Pause"}</option>
        </Select>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder={he ? "סיבה (אופציונלי)" : "Reason (optional)"} />
        <Button onClick={generate} disabled={!company.trim() || !product.trim()}>
          {he ? "הכן מכתב להעתקה" : "Generate letter"}
        </Button>
      </Card>

      {out && (
        <Card className="p-5">
          <div className="text-[12px] text-ink-soft font-bold">{he ? "נושא" : "Subject"}</div>
          <div className="font-extrabold mt-1">{out.subject}</div>
          <pre className="mt-4 whitespace-pre-wrap text-[13px] leading-relaxed bg-[#060b12] rounded-xl p-4 border border-[rgba(255,255,255,0.08)]">
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
            {copied ? (he ? "הועתק" : "Copied") : he ? "העתק הכול" : "Copy all"}
          </Button>
          <p className="text-[12px] text-ink-soft mt-3 mb-0">
            {he
              ? "שולחים במייל/צ׳אט של החברה. אם הורידו מחיר — תעדו בזכאי בדשבורד כחיסכון."
              : "Send via the company’s email/chat. If the price drops — record the saving on your dashboard."}
          </p>
        </Card>
      )}
    </div>
  );
}
