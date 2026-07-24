"use client";

import { useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { Card, Button, Input } from "@/components/ui";
import { formatAgorot } from "@/lib/money";
import type { Insight } from "@/lib/insights";
import { FAQ } from "@/lib/faq";

// A few high-signal starter questions surfaced as chips under the chat.
const SUGGESTED_IDS = ["fee", "taxrefund", "payslip", "family"] as const;

interface ChatMsg {
  role: "user" | "assistant";
  text: string;
}

/**
 * The assistant screen = two layers:
 *  1. Deterministic insight cards (server-computed, always available) — each
 *     one deep-links into an existing, gated product flow. The agent proposes;
 *     the flows (with their verification gates) execute.
 *  2. Free-text chat with the LLM — additive, plan-quota'd, and disabled
 *     honestly when no AI key is configured.
 */
export function AssistantScreen({
  insights,
  chatEnabled,
  plan,
  bcp47,
}: {
  insights: Insight[];
  chatEnabled: boolean;
  plan: "FREE" | "PRO" | "MAX";
  bcp47: string;
}) {
  const t = useTranslations("assistant");
  const locale = useLocale();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const money = (a: number) => formatAgorot(a, bcp47);

  function insightText(i: Insight): string {
    const p: Record<string, string | number> = { ...i.params };
    for (const k of ["potential", "fees", "price", "monthly", "yearly"]) {
      if (typeof p[k] === "number") p[k] = money(p[k] as number);
    }
    return t(`insights.${i.key}`, p as Record<string, string>);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    setChatError(null);
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChatError(data.error === "quotaExceeded" ? "quota" : "generic");
        return;
      }
      setMessages((m) => [...m, { role: "assistant", text: data.answer }]);
      setTimeout(() => listRef.current?.scrollTo({ top: 999999, behavior: "smooth" }), 50);
    } catch {
      setChatError("generic");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Layer 1: deterministic insights */}
      {insights.length > 0 && (
        <div className="flex flex-col gap-3 mb-8">
          {insights.map((i) => (
            <Card key={i.key} className="p-5 flex items-center gap-4 flex-wrap">
              <p className="flex-1 basis-[240px] m-0 text-[14.5px] leading-relaxed">
                {insightText(i)}
              </p>
              <Link href={i.href} className="no-underline shrink-0">
                <Button variant="ghost" className="!px-4 !py-2 !text-[13px]">
                  {t(`insightCta.${i.key}`)}
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      )}

      {/* Layer 2: chat */}
      <h2 className="text-[16px] font-extrabold mb-3">{t("chatTitle")}</h2>
      <Card className="p-5">
        {!chatEnabled ? (
          <p className="text-ink-soft text-[13.5px] m-0 leading-relaxed">{t("chatOffline")}</p>
        ) : (
          <>
            {plan === "FREE" && (
              <p className="text-[12px] text-ink-soft mt-0 mb-3">
                {t("freeQuotaNote")}{" "}
                <Link href="/pricing" className="text-emerald font-bold no-underline">
                  {t("upgradeLink")}
                </Link>
              </p>
            )}
            {/* Suggested questions — shown before the first message, pulled
                from the vetted FAQ so the agent starts on solid ground. */}
            {messages.length === 0 && (
              <div className="mb-4">
                <div className="text-[12px] text-ink-soft font-bold mb-2">{t("suggestTitle")}</div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_IDS.map((id) => {
                    const entry = FAQ.find((f) => f.id === id);
                    if (!entry) return null;
                    const q = locale === "he" ? entry.q_he : entry.q_en;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setInput(q)}
                        className="text-[12.5px] font-semibold text-ink-soft border border-[rgba(255,255,255,0.12)] rounded-full px-3 py-1.5 hover:border-[rgba(63,203,155,0.5)] hover:text-emerald transition-colors text-start"
                      >
                        {q}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {messages.length > 0 && (
              <div
                ref={listRef}
                className="flex flex-col gap-2.5 mb-4 max-h-[340px] overflow-y-auto pe-1"
              >
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed max-w-[85%] whitespace-pre-wrap ${
                      m.role === "user"
                        ? "self-end bg-[rgba(63,203,155,0.14)] border border-[rgba(63,203,155,0.25)]"
                        : "self-start bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.09)]"
                    }`}
                  >
                    {m.text}
                  </div>
                ))}
                {busy && (
                  <div className="self-start text-ink-soft text-[13px] px-2" aria-live="polite">
                    {t("thinking")}
                  </div>
                )}
              </div>
            )}
            {chatError && (
              <p className="text-danger text-[13px] font-semibold">
                {chatError === "quota" ? t("quotaError") : t("chatGenericError")}
              </p>
            )}
            <form onSubmit={send} className="flex gap-2.5">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("inputPlaceholder")}
                maxLength={1000}
              />
              <Button
                type="submit"
                disabled={busy || input.trim().length < 2}
                className="!px-5 !py-3 !text-[14.5px] shrink-0"
              >
                {t("send")}
              </Button>
            </form>
            <p className="text-[11px] text-ink-soft mt-3 mb-0 leading-snug">{t("disclaimer")}</p>
          </>
        )}
      </Card>

      {/* Under the assistant: the full FAQ, and the improve-Zakai box. */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-5 text-[13px]">
        <Link href="/faq" className="text-emerald font-bold no-underline">
          {t("moreFaq")}
        </Link>
        <span className="text-[rgba(147,166,165,0.4)]" aria-hidden>
          ·
        </span>
        <Link href="/feedback" className="text-ink-soft font-bold no-underline hover:text-emerald transition-colors">
          {t("leaveFeedback")}
        </Link>
      </div>
    </div>
  );
}
