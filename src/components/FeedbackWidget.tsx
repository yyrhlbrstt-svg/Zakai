"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Button, Textarea, Input, FieldError } from "@/components/ui";

/**
 * "What would you improve in Zakai?" — an inline feedback box. Posts to
 * /api/feedback (stored + emailed). Optional email if the user wants a reply.
 * Renders as a self-contained card so it can drop into the footer, the
 * assistant, or a dedicated page.
 */
export function FeedbackWidget({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("feedback");
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [tooShort, setTooShort] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const message = String(fd.get("message") || "").trim();
    if (message.length < 3) {
      setTooShort(true);
      return;
    }
    setTooShort(false);
    setState("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          email: String(fd.get("email") || ""),
          context: pathname || "",
        }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.07)] p-6 text-center">
        <div className="text-[34px] mb-1.5" aria-hidden>
          🙏
        </div>
        <div className="font-display text-xl">{t("doneTitle")}</div>
        <div className="text-ink-soft text-[13.5px] mt-1.5">{t("doneSub")}</div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] p-5"
    >
      {!compact && (
        <>
          <div className="font-extrabold text-[15.5px]">{t("title")}</div>
          <div className="text-ink-soft text-[13px] mt-1 mb-3">{t("sub")}</div>
        </>
      )}
      <Textarea
        name="message"
        rows={compact ? 3 : 4}
        placeholder={t("placeholder")}
        aria-label={t("title")}
        maxLength={2000}
        className="w-full"
      />
      {tooShort && <FieldError>{t("tooShort")}</FieldError>}
      <Input
        name="email"
        type="email"
        placeholder={t("emailPlaceholder")}
        aria-label={t("emailPlaceholder")}
        className="mt-3"
      />
      <Button type="submit" disabled={state === "sending"} className="w-full mt-3.5">
        {state === "sending" ? t("sending") : t("send")}
      </Button>
      {state === "error" && <FieldError>{t("error")}</FieldError>}
      <p className="text-[11px] text-ink-soft mt-2.5 text-center">{t("privacy")}</p>
    </form>
  );
}
