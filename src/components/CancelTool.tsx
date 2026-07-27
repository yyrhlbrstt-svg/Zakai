"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { Card, Button, Input, Select, Textarea } from "@/components/ui";
import { buildCancelLetter, type CancelIntent } from "@/lib/cancelLetter";

const INTENTS: CancelIntent[] = ["cancel", "retention", "downgrade", "pause"];

function parseIntent(v: string | null): CancelIntent {
  if (v && INTENTS.includes(v as CancelIntent)) return v as CancelIntent;
  return "cancel";
}

export function CancelTool() {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const router = useRouter();
  const search = useSearchParams();

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [product, setProduct] = useState("");
  const [account, setAccount] = useState("");
  const [monthly, setMonthly] = useState("");
  const [intent, setIntent] = useState<CancelIntent>("cancel");
  const [reason, setReason] = useState("");
  const [out, setOut] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  // Prefill from ?company=&product=&monthly=&intent=&name=
  useEffect(() => {
    const c = search.get("company") || search.get("merchant");
    const p = search.get("product") || search.get("plan");
    const m = search.get("monthly") || search.get("amount");
    const i = search.get("intent");
    const n = search.get("name");
    if (c) setCompany(c.slice(0, 120));
    if (p) setProduct(p.slice(0, 120));
    else if (c) setProduct(c.slice(0, 120));
    if (m && !Number.isNaN(Number(m))) setMonthly(String(Math.round(Number(m))));
    if (i) setIntent(parseIntent(i));
    if (n) setName(n.slice(0, 80));
    if (c || p || m) setPrefilled(true);
  }, [search]);

  function generate() {
    setError(null);
    setCaseId(null);
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

  async function sendWithAgent() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          company,
          product,
          accountOrEmail: account || undefined,
          monthlyShekels: monthly ? Number(monthly) : undefined,
          intent,
          reason: reason || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=/cancel`);
        return;
      }
      if (!res.ok) {
        setError(
          data.error === "caseLimit"
            ? he
              ? "הגעת למגבלת התיקים. שדרג או סגור תיק קיים."
              : "Case limit reached. Upgrade or close an open case."
            : he
              ? "משהו השתבש. נסה שוב."
              : "Something went wrong. Try again.",
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
      {prefilled && (
        <div className="rounded-xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.08)] px-4 py-3 text-[13px] font-bold">
          {he
            ? "מילאנו מהסריקה / הקישור — בדקו ולחצו על הסוכן"
            : "Prefilled from scan / link — review and let the agent act"}
        </div>
      )}

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

        <div className="flex flex-col gap-2 mt-1">
          <Button
            onClick={sendWithAgent}
            disabled={!company.trim() || !product.trim() || busy}
            className="w-full"
          >
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
            onClick={generate}
            disabled={!company.trim() || !product.trim() || busy}
            className="w-full text-[13px]"
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
              ? "המכתב מוכן ומאושר. בדשבורד: אמת בעלות (קוד לנייד) → צור Mandate → סמן כנשלח. הסוכן יעקוב ויתעד חיסכון. בלי מוקד."
              : "Letter ready and approved. On the dashboard: verify ownership (SMS code) → create Mandate → mark sent. The agent follows up and records the saving. No call center."}
          </p>
          <Link href="/dashboard">
            <Button className="w-full">{he ? "לדשבורד — המשך עכשיו (אימות + Mandate)" : "Dashboard — continue now (verify + Mandate)"}</Button>
          </Link>
        </Card>
      )}

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
              ? "אם בחרת ‘הסוכן שולח’ — הוא עושה את זה עם Mandate ועוקב. אחרת: שלח בעצמך במייל/צ׳אט של החברה, ואם הורידו מחיר — תעד בזכאי בדשבורד כחיסכון."
              : "If you chose ‘agent sends’ — it goes with Mandate and tracks. Otherwise: send yourself via the company’s email/chat. If the price drops — record the saving on your dashboard."}
          </p>
        </Card>
      )}
    </div>
  );
}
