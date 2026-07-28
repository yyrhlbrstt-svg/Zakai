"use client";

import { useState } from "react";
import { useLocale , useTranslations } from "next-intl";
import { Button } from "@/components/ui";

interface SentCase {
  id: string;
  providerLabel: string;
}

/**
 * Batch-draft follow-ups for every SENT case — the "overnight agent" feel.
 * Does not send; user reviews and copies. Human-in-the-loop stays intact.
 */
export function OvernightAgent({ cases }: { cases: SentCase[] }) {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const tIcomponents_OvernightAgent = useTranslations("inline_components_OvernightAgent");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<
    Array<{ id: string; providerLabel: string; body: string; tip?: string; error?: boolean }>
  >([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (cases.length === 0) return null;

  async function runBatch() {
    setBusy(true);
    setResults([]);
    const out: typeof results = [];
    for (const c of cases) {
      try {
        const res = await fetch(`/api/cases/${c.id}/follow-up`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ replyKind: "delay", round: 2 }),
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
        });
      } catch {
        out.push({ id: c.id, providerLabel: c.providerLabel, body: "", error: true });
      }
    }
    setResults(out);
    setBusy(false);
  }

  return (
    <div className="rounded-2xl border border-[rgba(139,92,246,0.35)] bg-[rgba(139,92,246,0.07)] px-5 py-4 mb-5">
      <div className="font-extrabold text-[14.5px]">
        {tIcomponents_OvernightAgent("t_aeb342ad")}
      </div>
      <p className="text-ink-soft text-[13px] mt-1 leading-relaxed">
        {he
          ? `יש ${cases.length} תיקים בסטטוס "נשלח". הסוכן מכין טיוטות תזכורת — אתה מעתיק ושולח. בלי מוקד.`
          : `${cases.length} SENT case(s). Agent drafts reminders — you copy and send. No call center.`}
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
              {r.error ? (
                <p className="text-[12.5px] text-amber mt-1 mb-0">
                  {tIcomponents_OvernightAgent("t_1768c8d7")}
                </p>
              ) : (
                <>
                  {r.tip && <p className="text-[12px] text-ink-soft mt-1 mb-2">{r.tip}</p>}
                  <pre className="whitespace-pre-wrap text-[12px] leading-relaxed max-h-40 overflow-y-auto bg-[#060b12] rounded-lg p-3 border border-[rgba(255,255,255,0.08)]">
                    {r.body}
                  </pre>
                  <Button
                    variant="ghost"
                    className="!text-[12.5px] !py-1.5 mt-2"
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
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
