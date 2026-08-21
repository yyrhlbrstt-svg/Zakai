"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Button, Input, Textarea } from "@/components/ui";
import { useLocalizedValidity } from "@/components/useLocalizedValidity";

/**
 * A message that is stored before anything is claimed about it.
 *
 * The API persists the row first and only then attempts mail, so the success
 * state here means "recorded", which is true whether or not a mail transport is
 * configured. Saying "sent" would be true only in one of those two worlds.
 */
export function ContactForm() {
  const t = useTranslations("contact");
  /* The native validation bubble, in the page's language rather than the browser's. */
  const validity = useLocalizedValidity();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("busy");
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: String(fd.get("message") ?? ""),
          email: String(fd.get("email") ?? ""),
          context: "contact",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error === "tooManyRequests" ? t("form.tooMany") : t("form.failed"));
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setError(t("form.failed"));
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <Card className="p-6">
        <p className="text-body-lg text-emerald m-0 font-bold">{t("form.recorded")}</p>
        <p className="text-caption text-ink-soft mt-2 mb-0 leading-relaxed">
          {t("form.recordedNote")}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="flex flex-col gap-3" {...validity}>
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-soft">{t("form.email")}</span>
          <Input name="email" type="email" dir="ltr" autoComplete="email" maxLength={160} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-soft">{t("form.message")}</span>
          <Textarea name="message" required minLength={3} maxLength={2000} rows={5} />
        </label>
        {error && (
          <p role="alert" className="text-caption text-[#ff8f8f] m-0">
            {error}
          </p>
        )}
        <div>
          <Button type="submit" disabled={state === "busy"}>
            {state === "busy" ? t("form.sending") : t("form.send")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
