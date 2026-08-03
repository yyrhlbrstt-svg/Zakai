"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { heEn } from "@/lib/heEn";

interface SentCase {
  id: string;
  providerLabel: string;
  agentRound?: number;
}

type SendBlock =
  | "NEEDS_OUTREACH_EMAIL"
  | "NO_ACTIVE_MANDATE"
  | "NO_TRANSPORT"
  | "MAX_ROUNDS"
  | "generic";

/**
 * Batch-draft follow-ups for every SENT case — overnight-agent feel.
 * Draft first (HITL), then optional Send via Zakai with Mandate.
 * Dashboard should only pass cases that already have ACTIVE Mandate + inbox;
 * send errors still surface specific unblock CTAs.
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
      sendBlock?: SendBlock;
      sent?: boolean;
      round?: number;
    }>
  >([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (cases.length === 0) return null;

  function classifySendError(error: unknown): SendBlock {
    if (error === "NEEDS_OUTREACH_EMAIL") return "NEEDS_OUTREACH_EMAIL";
    if (error === "NO_ACTIVE_MANDATE") return "NO_ACTIVE_MANDATE";
    if (error === "NO_TRANSPORT") return "NO_TRANSPORT";
    if (error === "MAX_ROUNDS") return "MAX_ROUNDS";
    return "generic";
  }

  function blockCopy(block: SendBlock): string {
    switch (block) {
      case "NEEDS_OUTREACH_EMAIL":
        return tIcomponents_OvernightAgent("errNeedsOutreach");
      case "NO_ACTIVE_MANDATE":
        return tIcomponents_OvernightAgent("errMandateInactive");
      case "NO_TRANSPORT":
        return tIcomponents_OvernightAgent("errNoTransport");
      case "MAX_ROUNDS":
        return tIcomponents_OvernightAgent("errMaxRounds");
      default:
        return tIcomponents_OvernightAgent("t_1768c8d7");
    }
  }

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
          const data = await res.json().catch(() => ({}));
          out.push({
            id: c.id,
            providerLabel: c.providerLabel,
            body: "",
            error: true,
            sendBlock: classifySendError(data.error),
          });
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
        out.push({
          id: c.id,
          providerLabel: c.providerLabel,
          body: "",
          error: true,
          sendBlock: "generic",
        });
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
                sendBlock: res.ok ? undefined : classifySendError(data.error),
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
          ? `יש ${cases.length} תיקים שחיכו כמה ימים בלי תשובה (Mandate פעיל + אימייל יעד). הסוכן מכין טיוטת המשך — אתם מאשרים ושולחים דרך זכאי. אם כבר ענו — הדביקו את התשובה בתיק.`
          : `${cases.length} SENT case(s) waited several days with no reply (ACTIVE Mandate + outreach inbox). Agent drafts a follow-up — you review, then send via Zakai. If they already replied — paste it on the case.`}
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
                <div className="mt-1">
                  <p className="text-[12.5px] text-amber mb-2">
                    {blockCopy(r.sendBlock ?? "generic")}
                  </p>
                  {(r.sendBlock === "NEEDS_OUTREACH_EMAIL" ||
                    r.sendBlock === "NO_ACTIVE_MANDATE" ||
                    r.sendBlock === "MAX_ROUNDS") && (
                    <Link
                      href={`/money?case=${r.id}`}
                      className="text-[12.5px] text-[#3EC6FF] font-bold no-underline"
                    >
                      {tIcomponents_OvernightAgent("openCase")} →
                    </Link>
                  )}
                </div>
              ) : (
                <>
                  {r.tip && <p className="text-[12px] text-ink-soft mt-1 mb-2">{r.tip}</p>}
                  <pre className="whitespace-pre-wrap text-[12px] leading-relaxed max-h-40 overflow-y-auto bg-[#060b12] rounded-lg p-3 border border-[rgba(255,255,255,0.08)]">
                    {r.body}
                  </pre>
                  {r.error && r.sendBlock ? (
                    <div className="mt-2">
                      <p className="text-[12.5px] text-amber mb-2">{blockCopy(r.sendBlock)}</p>
                      {(r.sendBlock === "NEEDS_OUTREACH_EMAIL" ||
                        r.sendBlock === "NO_ACTIVE_MANDATE" ||
                        r.sendBlock === "MAX_ROUNDS") && (
                        <Link
                          href={`/money?case=${r.id}`}
                          className="text-[12.5px] text-[#3EC6FF] font-bold no-underline"
                        >
                          {tIcomponents_OvernightAgent("openCase")} →
                        </Link>
                      )}
                    </div>
                  ) : null}
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
                    {!r.sent && !r.error ? (
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
                    ) : null}
                    {r.sent ? (
                      <span className="text-[12.5px] font-bold text-emerald self-center">
                        {heEn(he, "נשלח", "Sent")}
                      </span>
                    ) : null}
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
