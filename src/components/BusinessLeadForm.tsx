"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, Textarea, FieldError } from "@/components/ui";

/** B2B lead form for "Zakai for Employees". Posts to /api/business/lead. */
export function BusinessLeadForm() {
  const t = useTranslations("business");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const fd = new FormData(e.currentTarget);
    const payload = {
      company: String(fd.get("company") || ""),
      contact: String(fd.get("contact") || ""),
      email: String(fd.get("email") || ""),
      employees: String(fd.get("employees") || ""),
      note: String(fd.get("note") || ""),
    };
    try {
      const res = await fetch("/api/business/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.07)] p-8 text-center">
        <div className="text-[40px] mb-2" aria-hidden>✓</div>
        <div className="font-display text-2xl">{t("form.doneTitle")}</div>
        <div className="text-ink-soft text-[14px] mt-2">{t("form.doneSub")}</div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
      <label className="block">
        <span className="text-[13px] text-ink-soft block mb-1.5">{t("form.company")}</span>
        <Input name="company" required maxLength={120} />
      </label>
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("form.contact")}</span>
          <Input name="contact" required maxLength={120} />
        </label>
        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("form.email")}</span>
          <Input name="email" type="email" required maxLength={160} dir="ltr" />
        </label>
      </div>
      <label className="block">
        <span className="text-[13px] text-ink-soft block mb-1.5">{t("form.employees")}</span>
        <Input name="employees" inputMode="numeric" maxLength={40} />
      </label>
      <label className="block">
        <span className="text-[13px] text-ink-soft block mb-1.5">{t("form.note")}</span>
        <Textarea name="note" rows={3} maxLength={1000} />
      </label>
      {state === "error" && <FieldError>{t("form.error")}</FieldError>}
      <div className="mt-1">
        <Button type="submit" disabled={state === "sending"}>
          {state === "sending" ? t("form.sending") : t("form.submit")}
        </Button>
      </div>
      <p className="text-[11.5px] text-ink-soft leading-relaxed">{t("form.privacy")}</p>
    </form>
  );
}
