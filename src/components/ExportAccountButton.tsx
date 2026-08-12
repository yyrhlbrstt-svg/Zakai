"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";

/**
 * Take a copy of everything.
 *
 * A plain anchor to the endpoint would be simpler, but it gives no feedback on
 * a slow account and no way to say what went wrong — and this is the control a
 * person reaches for precisely when they have stopped trusting that things are
 * working, which is the worst moment for a button that appears to do nothing.
 */
export function ExportAccountButton() {
  const t = useTranslations("dataExport");
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  async function run() {
    setState("busy");
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) {
        setState("error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zakai-account-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <div>
      <Button variant="ghost" disabled={state === "busy"} onClick={run} className="!text-body">
        {state === "busy" ? t("busy") : t("cta")}
      </Button>
      <p className="text-micro text-ink-soft mt-2 mb-0 leading-relaxed">{t("hint")}</p>
      {state === "error" && (
        <p role="alert" className="text-caption text-[#ff8f8f] mt-2 mb-0">
          {t("failed")}
        </p>
      )}
    </div>
  );
}
