"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * "Pay your success fee" — kicks off the PSP checkout for a case's pending fee
 * and redirects the payer to the hosted payment page. Until a real PSP is
 * configured the mock flow routes through the internal callback, so the button
 * works end-to-end today.
 */
export function FeePayButton({ caseId }: { caseId: string }) {
  const t = useTranslations("dashboard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function pay() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/cases/${caseId}/fee/checkout`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={pay}
      disabled={busy}
      className="text-[12px] font-extrabold rounded-full px-3 py-1 bg-[rgba(63,203,155,0.14)] border border-[rgba(63,203,155,0.35)] text-emerald hover:bg-[rgba(63,203,155,0.22)] transition-colors disabled:opacity-60"
    >
      {busy ? t("feePaying") : error ? t("feePayError") : t("feePay")}
    </button>
  );
}
