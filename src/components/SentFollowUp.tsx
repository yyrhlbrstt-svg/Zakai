"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Button, FieldError } from "@/components/ui";
import { REPLY_KIND_OPTIONS, type ProviderReplyKind } from "@/lib/negotiation";

/** Multi-round negotiation UI reused on /check (sent stage) and anywhere else. */
export function SentFollowUp({ caseId }: { caseId: string }) {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const [replyKind, setReplyKind] = useState<ProviderReplyKind>("delay");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [body, setBody] = useState<string | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setErr(false);
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyKind, round: 2 }),
      });
      if (!res.ok) throw new Error("x");
      const data = await res.json();
      setBody(data.body || "");
      setTip(data.tip || null);
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-5 mt-4">
      <div className="font-extrabold text-[15px]">
        {he ? "מה ענו? — הסוכן מכין תשובה" : "Provider reply — agent drafts next message"}
      </div>
      <p className="text-[12.5px] text-ink-soft mt-1 mb-3 leading-relaxed">
        {he
          ? "בלי מוקד. בוחרים מה קרה, מקבלים הודעה להעתקה, שולחים, ואז רושמים את הסכום החדש."
          : "No call center. Pick what happened, copy the message, send it, then record the new amount."}
      </p>
      <select
        value={replyKind}
        onChange={(e) => setReplyKind(e.target.value as ProviderReplyKind)}
        className="w-full rounded-lg bg-[#0a1119] border border-[rgba(255,255,255,0.12)] text-ink text-[13px] px-3 py-2 mb-3"
      >
        {REPLY_KIND_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {he ? o.he : o.en}
          </option>
        ))}
      </select>
      <Button disabled={busy} onClick={generate} className="text-[13px]">
        {busy ? (he ? "רגע…" : "…") : he ? "הכן הודעת המשך" : "Draft follow-up"}
      </Button>
      {err && <FieldError>{he ? "שגיאה — נסה שוב" : "Error — try again"}</FieldError>}
      {tip && <p className="text-[12px] text-ink-soft mt-2 mb-0">{tip}</p>}
      {body && (
        <div className="mt-3">
          <pre className="whitespace-pre-wrap text-[12px] leading-relaxed bg-[#060b12] rounded-lg p-3 border border-[rgba(255,255,255,0.08)] max-h-56 overflow-y-auto">
            {body}
          </pre>
          <Button
            variant="ghost"
            className="mt-2 text-[13px]"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(body);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                /* ignore */
              }
            }}
          >
            {copied ? (he ? "הועתק" : "Copied") : he ? "העתק הודעה" : "Copy message"}
          </Button>
        </div>
      )}
    </div>
  );
}
