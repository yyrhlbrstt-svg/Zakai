"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { Card, Button, Input } from "@/components/ui";
import { buildRefundLetter } from "@/lib/refundChase";

export function RefundChaseTool() {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const router = useRouter();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [orderId, setOrderId] = useState("");
  const [product, setProduct] = useState("");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("14");
  const [out, setOut] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setError(
          data.error === "caseLimit"
            ? he
              ? "הגעת למגבלת התיקים. שדרג או סגור תיק קיים."
              : "Case limit reached."
            : he
              ? "משהו השתבש. נסה שוב."
              : "Something went wrong.",
        );
        return;
      }
      setOut({ subject: data.subject, body: data.body });
      setCaseId(data.caseId);
    } catch {
      setError(he ? "משהו השתבש. נסה שוב." : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5 flex flex-col gap-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={he ? "השם שלך" : "Your name"} />
        <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={he ? "חנות / אתר" : "Store / site"} />
        <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder={he ? "מספר הזמנה" : "Order ID"} />
        <Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder={he ? "מוצר (אופציונלי)" : "Product (optional)"} />
        <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={he ? "סכום ₪" : "Amount ₪"} />
        <Input type="number" value={days} onChange={(e) => setDays(e.target.value)} placeholder={he ? "כמה ימים מחכים" : "Days waiting"} />

        <div className="flex flex-col gap-2 mt-1">
          <Button onClick={sendWithAgent} disabled={!company.trim() || busy} className="w-full">
            {busy
              ? he
                ? "הסוכן פותח תיק…"
                : "Agent opening case…"
              : he
                ? "הסוכן שולח ומעקוב עכשיו"
                : "Agent sends & tracks now"}
          </Button>
          <Button
            variant="ghost"
            className="w-full text-[13px]"
            disabled={!company.trim() || busy}
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
            {he ? "רק הכן מכתב להעתקה" : "Just generate letter to copy"}
          </Button>
        </div>
        {error && <p className="text-[13px] text-amber mt-1 mb-0">{error}</p>}
      </Card>

      {caseId && (
        <Card className="p-5 border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)]">
          <div className="text-emerald font-extrabold text-[15px]">
            {he ? "✓ הסוכן פתח תיק — מאושר מראש" : "✓ Agent opened a case — pre-approved"}
          </div>
          <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed mb-3">
            {he
              ? "הדרישה מוכנה. בדשבורד: אמת בעלות → Mandate → סמן כנשלח. כשההחזר מגיע — תעד כחיסכון."
              : "Demand ready. On the dashboard: verify ownership → Mandate → mark sent. When the refund lands — record it as a saving."}
          </p>
          <Link href="/dashboard">
            <Button className="w-full">
              {he ? "לדשבורד — המשך עכשיו" : "Dashboard — continue now"}
            </Button>
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
            {copied ? (he ? "הועתק" : "Copied") : he ? "העתק" : "Copy"}
          </Button>
        </Card>
      )}
    </div>
  );
}
