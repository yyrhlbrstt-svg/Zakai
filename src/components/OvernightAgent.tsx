"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui";

interface SentCase {
  id: string;
  providerLabel: string;
  agentRound?: number;
}

/**
 * Batch-draft follow-ups for every SENT case — overnight-agent feel.
 * Draft first (HITL), then optional Send via Zakai with Mandate.
 */
export function OvernightAgent({ cases }: { cases: SentCase[] }) {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const router = useRouter();
  const tIcomponents_OvernightAgent = useTranslations("inline_components_OvernightAgent");
  const [busy, setBusy] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [results, setResults] = useState<
    Array<{
      id: string;
      providerLabel: string;
      body: string;
      tip?: string;
      error?: boolean;
      sent?: boolean;
      round?: number;
    }>
  >([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (cases.length === 0) return null;

  async function runBatch() {
    setBusy(true);
    setResults([]);
    const out: typeof results = [];
    for (const c of cases) {
      const round = Math.min(4, Math.max(2, (c.agentRound ?? 0) + 2));
      try {
        const res = await fetch(`/api/cases/${c.id}/follow-up`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ replyKind: "delay", round }),
        });
        if (!res.ok) {
          out.push({ id: c.id, providerLabel: c.providerLabel, body: "", error: true });
          continue;
        }
        const data = await res.json();
        out.push({
          id: c.id,
          providerLabel: c.providerLabel,
          body: data.body || "",
          tip: data.tip,
          round: data.round ?? round,
        });
      } catch {
        out.push({ id: c.id, providerLabel: c.providerLabel, body: "", error: true });
      }
    }
    setResults(out);
    setBusy(false);
  }

  async function sendOne(id: string, round?: number) {
    setSendingId(id);
    try {
      const res = await fetch(`/api/cases/${id}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyKind: "delay", round: round ?? 2, send: true }),
      });
      const data = await res.json().catch(() => ({}));
      setResults((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                sent: res.ok && data.sent,
                body: data.body || r.body,
                tip: data.tip || r.tip,
                error: !res.ok,
              }
            : r,
        ),
      );
      if (res.ok) router.refresh();
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-[rgba(139,92,246,0.35)] bg-[rgba(139,92,246,0.07)] px-5 py-4 mb-5">
      <div className="font-extrabold text-[14.5px]">
        {tIcomponents_OvernightAgent("t_aeb342ad")}
      </div>
      <p className="text-ink-soft text-[13px] mt-1 leading-relaxed">
        {he
          ? `יש ${cases.length} תיקים בסטטוס "נשלח". הסוכן מכין טיוטות — אתם מאשרים ושולחים דרך זכאי עם Mandate.`
          : `${cases.length} SENT case(s). Agent drafts reminders — you review, then send via Zakai with Mandate.`}
      </p>
      <Button className="mt-3" disabled={busy} onClick={runBatch}>
        {busy
          ? he
            ? "הסוכן כותב…"
            : "Agent drafting…"
          : he
            ? "הכן follow-up לכולם"
            : "Draft follow-ups for all"}
      </Button>

      {results.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {results.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(0,0,0,0.25)] p-3"
            >
              <div className="font-bold text-[13.5px]">{r.providerLabel}</div>
              {r.error && !r.body ? (
                <p className="text-[12.5px] text-amber mt-1 mb-0">
                  {tIcomponents_OvernightAgent("t_1768c8d7")}
                </p>
              ) : (
                <>
                  {r.tip && <p className="text-[12px] text-ink-soft mt-1 mb-2">{r.tip}</p>}
                  <pre className="whitespace-pre-wrap text-[12px] leading-relaxed max-h-40 overflow-y-auto bg-[#060b12] rounded-lg p-3 border border-[rgba(255,255,255,0.08)]">
                    {r.body}
                  </pre>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button
                      variant="ghost"
                      className="!text-[12.5px] !py-1.5"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(r.body);
                          setCopiedId(r.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        } catch {
                          /* ignore */
                        }
                      }}
                    >
                      {copiedId === r.id
                        ? he
                          ? "הועתק"
                          : "Copied"
                        : he
                          ? "העתק"
                          : "Copy"}
                    </Button>
                    {!r.sent ? (
                      <Button
                        className="!text-[12.5px] !py-1.5"
                        disabled={sendingId === r.id}
                        onClick={() => sendOne(r.id, r.round)}
                      >
                        {sendingId === r.id
                          ? he
                            ? "שולח…"
                            : "Sending…"
                          : he
                            ? "שלח דרך זכאי"
                            : "Send via Zakai"}
                      </Button>
                    ) : (
                      <span className="text-[12.5px] font-bold text-emerald self-center">
                        {he ? "נשלח" : "Sent"}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
