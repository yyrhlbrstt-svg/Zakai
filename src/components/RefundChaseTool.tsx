"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Card, Button, Input } from "@/components/ui";
import { buildRefundLetter } from "@/lib/refundChase";

export function RefundChaseTool() {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [orderId, setOrderId] = useState("");
  const [product, setProduct] = useState("");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("14");
  const [out, setOut] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5 flex flex-col gap-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={he ? "השם שלך" : "Your name"} />
        <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={he ? "חנות / אתר" : "Store / site"} />
        <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder={he ? "מספר הזמנה" : "Order ID"} />
        <Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder={he ? "מוצר (אופציונלי)" : "Product (optional)"} />
        <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={he ? "סכום ₪" : "Amount ₪"} />
        <Input type="number" value={days} onChange={(e) => setDays(e.target.value)} placeholder={he ? "כמה ימים מחכים" : "Days waiting"} />
        <Button
          disabled={!company.trim()}
          onClick={() =>
            setOut(
              buildRefundLetter({
                customerName: name,
                company,
                orderId,
                product,
                amountShekels: amount ? Number(amount) : undefined,
                daysWaiting: Number(days) || 0,
              }),
            )
          }
        >
          {he ? "הכן דרישת החזר" : "Draft refund demand"}
        </Button>
      </Card>
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
            {copied ? (he ? "הועתק" : "Copied") : he ? "העתק" : "Copy"}
          </Button>
        </Card>
      )}
    </div>
  );
}
