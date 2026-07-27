"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, Textarea, FieldError } from "@/components/ui";

/**
 * Commissionable lead form. Captures name + phone (+ optional note) for a given
 * vertical and posts to /api/lead. This is the honest monetisation entry point
 * for high-value verticals: Zakai connects the qualified lead to a vetted
 * professional/service and earns a success/referral fee — no upfront cost to
 * the user, and we never impersonate the professional.
 */
export function LeadForm({ vertical, title }: { vertical: string; title?: string }) {
  const t = useTranslations("lead");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    if (name.length < 1 || phone.length < 6) {
      setErr(true);
      return;
    }
    setErr(false);
    setState("sending");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vertical, name, phone, note: String(fd.get("note") || "") }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.07)] p-7 text-center">
        <div className="text-[38px] mb-1.5" aria-hidden>
          ✓
        </div>
        <div className="font-display text-2xl">{t("doneTitle")}</div>
        <div className="text-ink-soft text-[14px] mt-2 max-w-[420px] mx-auto">{t("doneSub")}</div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-[rgba(63,203,155,0.28)] bg-[rgba(63,203,155,0.05)] p-5 sm:p-6"
    >
      <div className="font-extrabold text-[16.5px]">{title || t("title")}</div>
      <div className="text-ink-soft text-[13px] mt-1 mb-4">{t("sub")}</div>

      <div className="flex flex-col gap-3">
        <Input name="name" placeholder={t("name")} aria-label={t("name")} autoComplete="name" maxLength={120} />
        <Input
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder={t("phone")}
          aria-label={t("phone")}
          autoComplete="tel"
          maxLength={40}
        />
        <Textarea name="note" rows={3} placeholder={t("note")} aria-label={t("note")} maxLength={1000} />
      </div>
      {err && <FieldError>{t("required")}</FieldError>}
      <Button type="submit" disabled={state === "sending"} className="w-full mt-4">
        {state === "sending" ? t("sending") : t("send")}
      </Button>
      {state === "error" && <FieldError>{t("error")}</FieldError>}
      <p className="text-[11px] text-ink-soft mt-2.5 text-center leading-relaxed">{t("privacy")}</p>
    </form>
  );
}
