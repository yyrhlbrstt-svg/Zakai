"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, FieldError } from "@/components/ui";

/**
 * Approve or refuse, and nothing else on the screen competes with them.
 *
 * Refuse is a real button of equal prominence, not a link in the corner. A
 * consent screen where saying no is harder than saying yes is not collecting
 * consent, it is collecting compliance — and an institution that later learns
 * how these grants were obtained stops honouring all of them.
 */
export function AuthorizeDecision({ requestId }: { requestId: string }) {
  const t = useTranslations("authorize");
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState(false);

  async function decide(approve: boolean) {
    setError(false);
    setBusy(approve ? "approve" : "deny");
    try {
      const res = await fetch("/api/agent/authorize/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId, approve }),
      });
      const data = (await res.json().catch(() => ({}))) as { redirect_to?: string };
      if (res.ok && data.redirect_to) {
        window.location.href = data.redirect_to;
        return;
      }
      setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-5 flex flex-col gap-3">
      <Button className="w-full" disabled={busy !== null} onClick={() => decide(true)}>
        {busy === "approve" ? t("approving") : t("approve")}
      </Button>
      <Button
        variant="ghost"
        className="w-full"
        disabled={busy !== null}
        onClick={() => decide(false)}
      >
        {t("deny")}
      </Button>
      {error && <FieldError>{t("failed")}</FieldError>}
    </div>
  );
}
