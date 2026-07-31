"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button, Input, Textarea, FieldError } from "@/components/ui";

/** B2B lead form — dual-track: employees welfare and/or Mandate infrastructure. */
export function BusinessLeadForm() {
  const t = useTranslations("business");
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const tIcomponents_BusinessLeadForm = useTranslations("inline_components_BusinessLeadForm");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [interest, setInterest] = useState<"employees" | "mandate" | "both">("employees");

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
      interest,
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

  const options: Array<{ id: "employees" | "mandate" | "both"; he: string; en: string }> = [
    { id: "employees", he: "הטבת עובדים", en: "Employee benefit" },
    { id: "mandate", he: "Mandate / API מוסדי", en: "Mandate / institutional API" },
    { id: "both", he: "שני המסלולים", en: "Both tracks" },
  ];

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
      <fieldset className="m-0 p-0 border-0">
        <legend className="text-[13px] text-ink-soft mb-2">
          {tIcomponents_BusinessLeadForm("t_ed765e5a")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setInterest(o.id)}
              className={`rounded-full px-3.5 py-2 text-[13px] font-bold border cursor-pointer transition-colors ${
                interest === o.id
                  ? "bg-[rgba(63,203,155,0.18)] border-[rgba(63,203,155,0.55)] text-emerald"
                  : "bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.12)] text-ink-soft"
              }`}
            >
              {he ? o.he : o.en}
            </button>
          ))}
        </div>
      </fieldset>

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
